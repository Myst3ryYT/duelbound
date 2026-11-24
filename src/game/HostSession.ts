/**
 * Online match, host side. The host's browser runs the real game:
 *  - its own player uses the keyboard and mouse directly (no delay)
 *  - the guest's inputs arrive over the network and are applied in order
 *  - every few ticks the whole world is sent to the guest as a snapshot (fast channel),
 *    and sounds / damage numbers are sent separately (reliable channel) so they're never lost
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
import { NET_STATS, RateCounter } from '../net/netDebug.ts';
import { Session } from './Session.ts';

export class HostSession extends Session {
  private send: (msg: HostMsg, fast?: boolean) => void;
  private lastQueuedSeq = 0; // newest guest input already queued (inputs arrive several times over)
  private snapRate = new RateCounter();
  private queue: PlayerInput[] = []; // guest inputs waiting to be applied
  private lastGuest: PlayerInput = emptyInput(); // reused if no new input arrived in time
  private ack = 0; // last guest input applied
  private outbox: GameEvent[] = []; // events to include in the next snapshot
  private ticksSinceSnap = 0;
  private lostAt: number | null = null; // when the guest dropped (seconds, performance clock)
  private ended: string | null = null; // reason text if the match ended early

  constructor(tuning: Tuning, keybinds: Keybinds, input: InputSource, renderer: Renderer, classes: [string, string], send: (msg: HostMsg, fast?: boolean) => void) {
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

  /** Guest inputs arrived (the newest few ticks; most were already received before). */
  receiveInputs(inputs: PlayerInput[]): void {
    for (const input of inputs) {
      if (input.seq <= this.lastQueuedSeq) continue; // already have it
      this.queue.push(input);
      this.lastQueuedSeq = input.seq;
    }
  }

  protected gatherInputs(local: PlayerInput): Map<number, PlayerInput> {
    // Too many piled up (lag spike)? Catch up by merging the oldest ones, so the guest
    // isn't stuck in the past. Button presses in skipped inputs are kept.
    while (this.queue.length > this.tuning.net.maxQueuedInputs) {
      const skipped = this.queue.shift()!;
      const b = this.queue[0].buttons;
      for (const k of Object.keys(b) as (keyof typeof b)[]) b[k] ||= skipped.buttons[k];
    }
    NET_STATS.role = 'host';
    NET_STATS.inputBuffer = this.queue.length;
    NET_STATS.snapshotsPerSec = this.snapRate.perSecond;
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

  /** Send the world (fast channel; `reliable` for ones that must arrive, like the final result). */
  private sendSnapshot(reliable = false): void {
    this.ticksSinceSnap = 0;
    if (this.outbox.length) this.send({ t: 'events', events: this.outbox });
    this.outbox = [];
    this.send({ t: 'snap', s: makeSnapshot(this.world, this.ack) }, !reliable);
    this.snapRate.hit();
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
    this.lastQueuedSeq = 0; // a rejoined guest may count again from the start
    this.sendSnapshot(true);
  }

  /** End the match now, with the host as the winner (the guest left or never came back). */
  endMatch(reason: string): void {
    const m = this.world.match;
    if (!m || m.phase === 'matchOver') return;
    this.ended = reason;
    this.lostAt = null;
    m.matchWinner = 0;
    m.phase = 'matchOver';
    this.sendSnapshot(true);
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
