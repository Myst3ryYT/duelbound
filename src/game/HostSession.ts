/**
 * Online match, host side. The host's browser runs the real game:
 *  - its own player uses the keyboard and mouse directly (no delay)
 *  - the guest's inputs arrive over the network and are applied in order
 *  - every few ticks the whole world is sent to the guest as a snapshot
 * Hits, damage and deaths are only ever decided here.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Keybinds } from '../config/keybinds.ts';
import type { InputSource } from '../input/InputSource.ts';
import { emptyInput, type Fighter, type GameEvent, type PlayerInput } from '../sim/types.ts';
import { createMatchWorld } from '../sim/world.ts';
import { getClass } from '../sim/classes/registry.ts';
import type { Renderer } from '../render/Renderer.ts';
import { makeSnapshot, type HostMsg } from '../net/protocol.ts';
import { Session } from './Session.ts';

export class HostSession extends Session {
  private send: (msg: HostMsg) => void;
  private queue: PlayerInput[] = []; // guest inputs waiting to be applied
  private lastGuest: PlayerInput = emptyInput(); // reused if no new input arrived in time
  private ack = 0; // last guest input applied
  private outbox: GameEvent[] = []; // events to include in the next snapshot
  private ticksSinceSnap = 0;
  private lostAt: number | null = null; // when the guest dropped (seconds, performance clock)
  private ended: string | null = null; // reason text if the match ended early

  constructor(tuning: Tuning, keybinds: Keybinds, input: InputSource, renderer: Renderer, classes: [string, string], send: (msg: HostMsg) => void) {
    super(tuning, keybinds, input, renderer);
    this.send = send;
    this.world = createMatchWorld(tuning, 'online', classes, ['You', 'Opponent']);
    renderer.reset();
  }

  get online(): boolean {
    return true;
  }
  get player(): Fighter {
    return this.world.fighters.find((f) => f.side === 0)!;
  }
  get opponent(): Fighter {
    return this.world.fighters.find((f) => f.side === 1)!;
  }

  /** A guest input arrived. */
  receiveInput(input: PlayerInput): void {
    this.queue.push(input);
  }

  protected gatherInputs(local: PlayerInput): Map<number, PlayerInput> {
    // Too many piled up (lag spike)? Skip ahead so the guest isn't stuck in the past.
    while (this.queue.length > this.tuning.net.maxQueuedInputs) this.queue.shift();
    const next = this.queue.shift();
    if (next) {
      this.lastGuest = next;
      this.ack = next.seq;
    }
    return new Map([
      [this.player.id, local],
      [this.opponent.id, this.lastGuest],
    ]);
  }

  step(): void {
    if (this.ended) return;
    if (this.lostAt !== null) {
      // Guest dropped: freeze the match and wait for them to come back.
      if (performance.now() / 1000 - this.lostAt >= this.tuning.net.reconnectWait) this.endMatch('Opponent disconnected');
      return;
    }
    super.step();
    this.ticksSinceSnap++;
    if (this.ticksSinceSnap >= this.tuning.net.snapshotEvery || this.world.match?.phase === 'matchOver') this.sendSnapshot();
  }

  protected flushEvents(): void {
    this.outbox.push(...this.world.events);
    super.flushEvents();
  }

  private sendSnapshot(): void {
    this.ticksSinceSnap = 0;
    this.send({ t: 'snap', s: makeSnapshot(this.world, this.ack, this.outbox) });
    this.outbox = [];
  }

  // ---- Connection problems ----

  /** The guest's connection dropped. */
  linkLost(): void {
    if (this.ended || this.matchOver) return;
    this.lostAt = performance.now() / 1000;
    this.queue = [];
    this.lastGuest = emptyInput();
  }

  /** The guest came back: carry on. */
  linkRestored(): void {
    this.lostAt = null;
    this.sendSnapshot();
  }

  /** End the match now, with the host as the winner (the guest left or never came back). */
  endMatch(reason: string): void {
    const m = this.world.match;
    if (!m || m.phase === 'matchOver') return;
    this.ended = reason;
    this.lostAt = null;
    m.matchWinner = 0;
    m.phase = 'matchOver';
    this.sendSnapshot();
  }

  get endReason(): string | null {
    return this.ended;
  }

  banner(): string | null {
    if (this.lostAt === null) return null;
    const left = Math.max(0, Math.ceil(this.tuning.net.reconnectWait - (performance.now() / 1000 - this.lostAt)));
    return `Opponent disconnected - waiting ${left}s for them to come back`;
  }

  protected helpLines(): string[] {
    const me = getClass(this.player.classId)?.name ?? '';
    const them = getClass(this.opponent.classId)?.name ?? '';
    return [`ONLINE (HOST) - ${me} vs ${them}`, `${this.key('pause')}  menu (the game keeps running)`];
  }
}
