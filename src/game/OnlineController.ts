/**
 * Runs one online game from either side (host or guest):
 *   waiting for a friend -> character select (lobby) -> match -> rematch? -> lobby ...
 * It owns the network connection and routes messages to the lobby or the match.
 * The App gives it a few UI callbacks (show lobby, start a session, show a message).
 */
import type { Tuning } from '../config/tuning.ts';
import type { Keybinds } from '../config/keybinds.ts';
import type { InputSource } from '../input/InputSource.ts';
import type { Renderer } from '../render/Renderer.ts';
import { deepAssignNumbers } from '../dev/tuningFile.ts';
import { HostRoom, GuestPeer, type NetLink } from '../platform/peer.ts';
import type { GuestMsg, HostMsg, LobbyState } from '../net/protocol.ts';
import { HostSession } from './HostSession.ts';
import { GuestSession } from './GuestSession.ts';
import type { Session } from './Session.ts';

export interface OnlineUi {
  /** Host only: the room is open and waiting for someone to join. */
  showWaiting(code: string): void;
  /** Show / update character select. `mine` = my pick, `theirs` = the other player's. */
  showLobby(mine: { classId: string; ready: boolean }, theirs: { classId: string; ready: boolean }, fresh: boolean): void;
  /** A match started: draw and run this session. */
  startSession(session: Session): void;
  /** Rematch votes changed. */
  rematchVotes(me: boolean, them: boolean): void;
  /** Something ended the online game (opponent left before a match, connection failed...). */
  message(title: string, text: string): void;
}

interface Deps {
  tuning: Tuning;
  keybinds: Keybinds;
  input: InputSource;
  renderer: Renderer;
  ui: OnlineUi;
}

type Phase = 'waiting' | 'lobby' | 'match' | 'closed';

// ===================================================================== HOST ====

export class OnlineHost {
  private room: HostRoom;
  private link: NetLink | null = null;
  private phase: Phase = 'waiting';
  private lobby: LobbyState = { hostClass: 'mage', hostReady: false, guestClass: 'mage', guestReady: false };
  private session: HostSession | null = null;
  private votes = { host: false, guest: false };
  private deps: Deps;

  private constructor(room: HostRoom, deps: Deps) {
    this.room = room;
    this.deps = deps;
    room.onGuest = (link) => this.onGuest(link);
    deps.ui.showWaiting(room.code);
  }

  /** Open a room. Rejects with a readable error if that fails. */
  static async create(deps: Deps): Promise<OnlineHost> {
    return new OnlineHost(await HostRoom.create(), deps);
  }

  get code(): string {
    return this.room.code;
  }

  /** True while the room is open with nobody in it. */
  get waiting(): boolean {
    return this.phase === 'waiting';
  }

  private send(msg: HostMsg): void {
    this.link?.send(msg);
  }

  private onGuest(link: NetLink): void {
    const linkGone = !this.link || !this.link.open;
    // The same guest coming back mid-match after a drop:
    const reconnecting = this.phase === 'match' && !!this.session && !this.session.matchOver && linkGone;
    // A new guest after the previous one left a finished match: start over in the lobby.
    const afterMatch = this.phase === 'match' && !!this.session?.matchOver && linkGone;
    if (!linkGone || (this.phase !== 'waiting' && !reconnecting && !afterMatch)) {
      link.close(); // room is full
      return;
    }
    this.link = link;
    link.onMessage = (m) => this.onMessage(m as GuestMsg);
    link.onClose = () => this.onClose(link);
    if (reconnecting) {
      this.session!.linkRestored();
      return;
    }
    this.phase = 'lobby';
    this.lobby.hostReady = false;
    this.lobby.guestReady = false;
    this.sendLobby(true);
  }

  private onClose(link: NetLink): void {
    if (link !== this.link || this.phase === 'closed') return;
    if (this.phase === 'match' && this.session && !this.session.matchOver) {
      this.session.linkLost(); // wait for them to come back
      return;
    }
    // Left during character select or after the match: back to waiting for someone new.
    this.link = null;
    this.phase = 'waiting';
    this.session = null;
    this.deps.ui.message('Opponent left', 'Your friend left the room. The room is still open: share the code again to play.');
  }

  private onMessage(m: GuestMsg): void {
    switch (m.t) {
      case 'pick':
        if (this.phase !== 'lobby') return;
        this.lobby.guestClass = m.classId;
        this.lobby.guestReady = m.ready;
        this.sendLobby(false);
        this.maybeStart();
        return;
      case 'input':
        this.session?.receiveInput(m.input);
        return;
      case 'rematch':
        this.votes.guest = true;
        this.sendVotes();
        return;
      case 'leave':
        this.link?.close();
        this.link = null;
        if (this.phase === 'match' && this.session && !this.session.matchOver) {
          this.session.endMatch('Opponent left');
        } else {
          this.phase = 'waiting';
          this.deps.ui.message('Opponent left', 'Your friend left the room. The room is still open: share the code again to play.');
        }
        return;
    }
  }

  /** Local player changed their pick / ready state. */
  pick(classId: string, ready: boolean): void {
    this.lobby.hostClass = classId;
    this.lobby.hostReady = ready;
    this.sendLobby(false);
    this.maybeStart();
  }

  private sendLobby(fresh: boolean): void {
    this.send({ t: 'lobby', lobby: this.lobby });
    this.deps.ui.showLobby(
      { classId: this.lobby.hostClass, ready: this.lobby.hostReady },
      { classId: this.lobby.guestClass, ready: this.lobby.guestReady },
      fresh,
    );
  }

  private maybeStart(): void {
    if (!this.lobby.hostReady || !this.lobby.guestReady || !this.link) return;
    const d = this.deps;
    const classes: [string, string] = [this.lobby.hostClass, this.lobby.guestClass];
    this.send({ t: 'start', tuning: d.tuning, classes });
    this.session = new HostSession(d.tuning, d.keybinds, d.input, d.renderer, classes, (msg) => this.send(msg));
    this.phase = 'match';
    this.votes = { host: false, guest: false };
    d.ui.startSession(this.session);
  }

  /** Local player wants a rematch. */
  rematch(): void {
    this.votes.host = true;
    this.sendVotes();
  }

  private sendVotes(): void {
    this.send({ t: 'rematch', host: this.votes.host, guest: this.votes.guest });
    this.deps.ui.rematchVotes(this.votes.host, this.votes.guest);
    if (this.votes.host && this.votes.guest) {
      this.send({ t: 'toLobby' });
      this.session = null;
      this.phase = 'lobby';
      this.lobby.hostReady = false;
      this.lobby.guestReady = false;
      this.sendLobby(true);
    }
  }

  /** Leave on purpose: tell the guest and close the room. */
  leave(): void {
    this.phase = 'closed';
    this.send({ t: 'leave' });
    setTimeout(() => {
      this.link?.close();
      this.room.close();
    }, 150);
  }
}

// ==================================================================== GUEST ====

export class OnlineGuest {
  private peer = new GuestPeer();
  private link: NetLink | null = null;
  private phase: Phase = 'lobby';
  private session: GuestSession | null = null;
  private mine = { classId: 'mage', ready: false };
  private code: string;
  private deps: Deps;

  private constructor(code: string, deps: Deps) {
    this.code = code;
    this.deps = deps;
  }

  /** Connect to a room code. Rejects with a readable error if that fails. */
  static async join(code: string, deps: Deps): Promise<OnlineGuest> {
    const g = new OnlineGuest(code, deps);
    try {
      g.attach(await g.peer.join(code));
    } catch (err) {
      g.peer.close();
      throw err;
    }
    return g;
  }

  private attach(link: NetLink): void {
    this.link = link;
    link.onMessage = (m) => this.onMessage(m as HostMsg);
    link.onClose = () => this.onClose(link);
  }

  private send(msg: GuestMsg): void {
    this.link?.send(msg);
  }

  private onMessage(m: HostMsg): void {
    switch (m.t) {
      case 'lobby': {
        const fresh = this.phase !== 'lobby' || !this.seenLobby;
        this.seenLobby = true;
        this.phase = 'lobby';
        this.mine.ready = m.lobby.guestReady; // host is the source of truth
        this.deps.ui.showLobby({ classId: this.mine.classId, ready: this.mine.ready }, { classId: m.lobby.hostClass, ready: m.lobby.hostReady }, fresh);
        return;
      }
      case 'start': {
        // Both players use the host's numbers so the game looks the same on both screens.
        deepAssignNumbers(this.deps.tuning, m.tuning as object);
        const d = this.deps;
        this.session = new GuestSession(d.tuning, d.keybinds, d.input, d.renderer, (msg) => this.send(msg));
        this.phase = 'match';
        d.ui.startSession(this.session);
        return;
      }
      case 'snap':
        this.session?.receiveSnapshot(m.s);
        return;
      case 'rematch':
        this.deps.ui.rematchVotes(m.guest, m.host);
        return;
      case 'toLobby':
        this.session = null;
        this.seenLobby = false;
        this.phase = 'lobby';
        return; // the host's next 'lobby' message opens character select
      case 'leave':
        this.phase = 'closed';
        this.link?.close();
        this.peer.close();
        if (this.session && !this.session.matchOver) this.session.endMatch('Opponent left');
        else this.deps.ui.message('Host left', 'The host closed the room.');
        return;
    }
  }
  private seenLobby = false;

  private onClose(link: NetLink): void {
    if (link !== this.link || this.phase === 'closed') return;
    if (this.phase === 'match' && this.session && !this.session.matchOver) {
      this.session.linkLost();
      void this.tryRejoin();
      return;
    }
    this.phase = 'closed';
    this.peer.close();
    this.deps.ui.message('Disconnected', 'Lost the connection to the host.');
  }

  /** Keep trying to get back into the room for a few seconds. */
  private async tryRejoin(): Promise<void> {
    const until = performance.now() / 1000 + this.deps.tuning.net.reconnectWait;
    while (performance.now() / 1000 < until && this.phase === 'match') {
      try {
        this.attach(await this.peer.join(this.code, 3000));
        this.session?.linkRestored();
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (this.phase === 'match') this.session?.endMatch('Host disconnected');
  }

  pick(classId: string, ready: boolean): void {
    this.mine = { classId, ready };
    this.send({ t: 'pick', classId, ready });
  }

  rematch(): void {
    this.send({ t: 'rematch' });
  }

  leave(): void {
    this.phase = 'closed';
    this.send({ t: 'leave' });
    setTimeout(() => {
      this.link?.close();
      this.peer.close();
    }, 150);
  }
}

export type OnlineGame = OnlineHost | OnlineGuest;
