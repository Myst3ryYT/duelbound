/**
 * Online match, guest side. The guest does NOT run the real game. It:
 *  - sends its inputs to the host every tick
 *  - moves its own character straight away (prediction), so controls feel instant,
 *    and quietly corrects itself when the host's snapshot says otherwise
 *  - draws everything else ~100 ms in the past, blended between two snapshots,
 *    so other players and shots move smoothly even though updates arrive 30x a second
 *  - plays sounds and effects that the host reports
 * HP, hits and deaths are only ever changed by the host.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Keybinds } from '../config/keybinds.ts';
import type { InputSource } from '../input/InputSource.ts';
import type { Fighter, PlayerInput, World } from '../sim/types.ts';
import { getClass } from '../sim/classes/registry.ts';
import { predictStep } from '../sim/predict.ts';
import type { Renderer } from '../render/Renderer.ts';
import { worldFromSnapshot, type GuestMsg, type Snapshot } from '../net/protocol.ts';
import { Session } from './Session.ts';

const MY_SIDE = 1; // the guest is always the right-hand player

export class GuestSession extends Session {
  private send: (msg: GuestMsg) => void;
  private snaps: Snapshot[] = []; // recent snapshots, oldest first
  private latest: World | null = null; // newest snapshot as a world (for prediction)
  private pending: PlayerInput[] = []; // inputs the host hasn't confirmed yet
  private predicted: Fighter | null = null; // our own character, moved locally
  private predictedPrev = { x: 0, y: 0 }; // its position one tick ago (for smooth drawing)
  private correction = { x: 0, y: 0 }; // leftover error from the last correction, faded out over a few frames
  private clockOffset: number | null = null; // local clock minus host game time
  private lastRenderTime = performance.now() / 1000;
  private ended: string | null = null;
  private waiting: number | null = null; // reconnect countdown start, if the host dropped

  constructor(tuning: Tuning, keybinds: Keybinds, input: InputSource, renderer: Renderer, send: (msg: GuestMsg) => void) {
    super(tuning, keybinds, input, renderer);
    this.send = send;
    renderer.reset();
  }

  get online(): boolean {
    return true;
  }
  get ready(): boolean {
    return this.latest !== null;
  }
  get player(): Fighter {
    return this.world.fighters.find((f) => f.side === MY_SIDE)!;
  }
  get opponent(): Fighter {
    return this.world.fighters.find((f) => f.side !== MY_SIDE)!;
  }

  protected gatherInputs(): Map<number, PlayerInput> {
    return new Map(); // never used: the guest doesn't step the real game
  }

  /** One local tick: send our input, and move our own character right away. */
  step(): void {
    if (!this.latest || !this.predicted || this.ended) return;
    const input = this.input.sample(this.renderer.view.screenToWorld, this.predicted.x, this.predicted.y);
    this.send({ t: 'input', input });
    this.pending.push(input);
    if (this.pending.length > 240) this.pending.shift();
    this.predictedPrev = { x: this.predicted.x, y: this.predicted.y };
    predictStep(this.latest, this.predicted, input, this.tuning);
  }

  /** A snapshot arrived from the host. */
  receiveSnapshot(s: Snapshot): void {
    const now = performance.now() / 1000;
    // Keep a running estimate of how the host's game clock lines up with ours.
    const sample = now - s.time;
    if (this.clockOffset === null || sample < this.clockOffset) this.clockOffset = sample;
    else this.clockOffset += (sample - this.clockOffset) * 0.02;

    if (this.snaps.length && s.tick <= this.snaps[this.snaps.length - 1].tick) return; // old / duplicate
    this.snaps.push(s);
    if (this.snaps.length > 40) this.snaps.shift();

    const world = worldFromSnapshot(s);
    this.latest = world;
    if (!this.world) this.world = world;
    this.playEvents(s.events, world);
    this.reconcile(s);
  }

  /** Take the host's word for where we are, then replay the inputs it hasn't seen yet. */
  private reconcile(s: Snapshot): void {
    const server = s.fighters.find((f) => f.side === MY_SIDE);
    if (!server || !this.latest) return;
    const before = this.predicted ? { x: this.predicted.x, y: this.predicted.y } : null;
    this.pending = this.pending.filter((i) => i.seq > s.ack);
    const p: Fighter = { ...server, vars: { ...server.vars } };
    for (const input of this.pending) predictStep(this.latest, p, input, this.tuning);
    this.predicted = p;
    if (before) {
      // Don't jump: remember the difference and fade it out (unless it's a big jump like a teleport).
      const dx = before.x - p.x;
      const dy = before.y - p.y;
      if (Math.hypot(dx, dy) < 80) {
        this.correction.x += dx;
        this.correction.y += dy;
        this.predictedPrev.x -= dx;
        this.predictedPrev.y -= dy;
      } else {
        this.correction = { x: 0, y: 0 };
        this.predictedPrev = { x: p.x, y: p.y };
      }
    } else this.predictedPrev = { x: p.x, y: p.y };
  }

  /** Draw ~100 ms in the past, blending the two snapshots around that moment. */
  renderState(alpha: number): { world: World; prev: Map<number, { x: number; y: number }>; alpha: number } {
    const now = performance.now() / 1000;
    const frameDt = Math.min(0.1, now - this.lastRenderTime);
    this.lastRenderTime = now;
    if (!this.snaps.length || this.clockOffset === null) return { world: this.world, prev: this.prev, alpha };

    const target = now - this.clockOffset - this.tuning.net.interpDelay;
    let b = this.snaps.findIndex((s) => s.time >= target);
    if (b === -1) b = this.snaps.length - 1; // running ahead of the data: hold the newest
    const a = Math.max(0, b - 1);
    const sa = this.snaps[a];
    const sb = this.snaps[b];
    const k = sb.time > sa.time ? Math.min(1, Math.max(0, (target - sa.time) / (sb.time - sa.time))) : 1;

    // Positions from the older snapshot become "prev"; the renderer blends to the newer one by k.
    const prev = new Map<number, { x: number; y: number }>();
    for (const list of [sa.fighters, sa.projectiles, sa.objects]) for (const e of list) prev.set(e.id, { x: e.x, y: e.y });

    const world = worldFromSnapshot(sb);
    world.fighters = sb.fighters.map((f) => ({ ...f, name: f.side === MY_SIDE ? 'You' : 'Opponent' }));

    // Our own character: the predicted position (now, not in the past), with the newest state.
    if (this.predicted && this.latest) {
      const fresh = this.latest.fighters.find((f) => f.side === MY_SIDE)!;
      const fade = Math.exp(-frameDt * 15);
      this.correction.x *= fade;
      this.correction.y *= fade;
      const x = this.predictedPrev.x + (this.predicted.x - this.predictedPrev.x) * alpha + this.correction.x;
      const y = this.predictedPrev.y + (this.predicted.y - this.predictedPrev.y) * alpha + this.correction.y;
      const me = { ...fresh, name: 'You', x, y, aimAngle: this.predicted.aimAngle, aimX: this.predicted.aimX, aimY: this.predicted.aimY };
      world.fighters = world.fighters.map((f) => (f.side === MY_SIDE ? me : f));
      prev.set(me.id, { x, y });
    }
    // The match clock and results come from the newest snapshot (no need to show them late).
    world.match = this.latest?.match ?? world.match;
    this.world = world;
    return { world, prev, alpha: k };
  }

  // ---- Connection problems ----

  /** Lost the host; the controller is trying to reconnect. */
  linkLost(): void {
    if (!this.ended) this.waiting = performance.now() / 1000;
  }
  linkRestored(): void {
    this.waiting = null;
  }

  /** The host left or never came back: the guest wins. */
  endMatch(reason: string): void {
    if (this.ended) return;
    this.ended = reason;
    this.waiting = null;
    const m = this.latest?.match;
    if (m && m.phase !== 'matchOver') {
      m.matchWinner = MY_SIDE;
      m.phase = 'matchOver';
    }
  }

  get endReason(): string | null {
    return this.ended;
  }

  get matchOver(): boolean {
    return this.latest?.match?.phase === 'matchOver';
  }

  banner(): string | null {
    if (this.waiting === null) return null;
    const left = Math.max(0, Math.ceil(this.tuning.net.reconnectWait - (performance.now() / 1000 - this.waiting)));
    return `Connection to host lost - reconnecting (${left}s)`;
  }

  protected helpLines(): string[] {
    const me = getClass(this.player?.classId ?? '')?.name ?? '';
    const them = getClass(this.opponent?.classId ?? '')?.name ?? '';
    return [`ONLINE (GUEST) - ${me} vs ${them}`, `${this.key('pause')}  menu (the game keeps running)`];
  }
}
