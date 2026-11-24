/**
 * Online match, guest side. The host runs the real game; the guest:
 *  - sends its inputs to the host every tick
 *  - PREDICTS its own side straight away: it runs the same game rules locally on a
 *    copy of the host's latest snapshot, replaying the inputs the host hasn't seen yet.
 *    So your own walking, shots, abilities, cooldowns and structures react instantly
 *    instead of waiting a whole round trip. When the host's next snapshot arrives the
 *    copy is rebuilt from it, so a wrong guess fixes itself within a few frames.
 *  - draws everything else (the opponent and their stuff) ~interpDelay in the past,
 *    blended between two snapshots, so it moves smoothly
 *  - plays sounds and effects that the host reports
 * HP, hits and deaths are only ever decided by the host.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Keybinds } from '../config/keybinds.ts';
import type { InputSource } from '../input/InputSource.ts';
import type { Fighter, GameEvent, PlayerInput, World } from '../sim/types.ts';
import { stepWorld } from '../sim/world.ts';
import { getClass } from '../sim/classes/registry.ts';
import type { Renderer } from '../render/Renderer.ts';
import { worldFromSnapshot, type GuestMsg, type Snapshot } from '../net/protocol.ts';
import { NET_STATS, RateCounter } from '../net/netDebug.ts';
import { Session } from './Session.ts';

const MY_SIDE = 1; // the guest is always the right-hand player
const INPUT_REPEAT = 5; // each input packet also repeats the previous few inputs, in case packets get lost
const PREDICTED_ID_OFFSET = 1_000_000; // ids for things the guest predicts, so they never clash with the host's

type Pos = { x: number; y: number };

export class GuestSession extends Session {
  private send: (msg: GuestMsg, fast?: boolean) => void;
  private snaps: Snapshot[] = []; // recent snapshots, oldest first
  private latest: World | null = null; // newest snapshot as a world
  private pending: PlayerInput[] = []; // inputs the host hasn't confirmed yet
  private pred: World | null = null; // our guess of "now": latest snapshot + unconfirmed inputs replayed
  private predPrev = new Map<number, Pos>(); // positions in `pred` one tick ago (for smooth drawing)
  private myId = 0;
  private correction = { x: 0, y: 0 }; // leftover error from the last correction, faded out over a few frames
  private clockOffset: number | null = null; // local clock minus host game time
  private lastRenderTime = performance.now() / 1000;
  private ended: string | null = null;
  private waiting: number | null = null; // reconnect countdown start, if the host dropped
  private snapRate = new RateCounter();

  constructor(tuning: Tuning, keybinds: Keybinds, input: InputSource, renderer: Renderer, send: (msg: GuestMsg, fast?: boolean) => void) {
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

  private predictedMe(): Fighter | undefined {
    return this.pred?.fighters.find((f) => f.id === this.myId);
  }

  /** One local tick: send our input, and move our own side forward right away. */
  step(): void {
    const me = this.predictedMe();
    if (!this.pred || !me || this.ended) return;
    const input = this.input.sample(this.renderer.view.screenToWorld, me.x, me.y);
    this.pending.push(input);
    if (this.pending.length > 240) this.pending.shift();
    this.send({ t: 'inputs', inputs: this.pending.slice(-INPUT_REPEAT) }, true);
    this.rememberPredPositions();
    this.predictTick(input);
    NET_STATS.role = 'guest';
    NET_STATS.inputBuffer = this.pending.length;
    NET_STATS.snapshotsPerSec = this.snapRate.perSecond;
  }

  /** One tick of the real game rules on our private copy. Its events are ignored (the host reports the real ones). */
  private predictTick(input: PlayerInput): void {
    if (this.pred) stepWorld(this.pred, new Map([[this.myId, input]]), this.tuning);
  }

  private rememberPredPositions(): void {
    this.predPrev.clear();
    if (!this.pred) return;
    for (const list of [this.pred.fighters, this.pred.projectiles, this.pred.objects]) for (const e of list) this.predPrev.set(e.id, { x: e.x, y: e.y });
  }

  /** A snapshot arrived from the host. */
  receiveSnapshot(s: Snapshot): void {
    const now = performance.now() / 1000;
    // Keep a running estimate of how the host's game clock lines up with ours.
    const sample = now - s.time;
    if (this.clockOffset === null || sample < this.clockOffset) this.clockOffset = sample;
    else this.clockOffset += (sample - this.clockOffset) * 0.02;

    if (this.snaps.length && s.tick <= this.snaps[this.snaps.length - 1].tick) return; // old / duplicate / out of order
    this.snapRate.hit();
    this.snaps.push(s);
    if (this.snaps.length > 40) this.snaps.shift();

    const world = worldFromSnapshot(s);
    this.latest = world;
    if (!this.world) this.world = world;
    this.myId = s.fighters.find((f) => f.side === MY_SIDE)?.id ?? 0;
    this.rebuildPrediction(s);
  }

  /** Sounds, damage numbers and effects reported by the host. */
  receiveEvents(events: GameEvent[]): void {
    if (this.latest) this.playEvents(events, this.latest);
  }

  /** Start again from the host's word, then replay the inputs it hasn't seen yet. */
  private rebuildPrediction(s: Snapshot): void {
    const before = this.predictedMe();
    const oldPos = before ? { x: before.x, y: before.y } : null;

    const pred = worldFromSnapshot(structuredClone(s));
    pred.nextId = s.nextId + PREDICTED_ID_OFFSET;
    // Nobody can die or run out the clock in the guess: only the host decides that.
    for (const f of pred.fighters) f.hp = f.maxHp = 1e9;
    if (pred.match) pred.match.roundTime = 1e9;
    this.pred = pred;

    this.pending = this.pending.filter((i) => i.seq > s.ack);
    this.rememberPredPositions();
    for (let i = 0; i < this.pending.length; i++) {
      if (i === this.pending.length - 1) this.rememberPredPositions(); // "one tick ago" = before the last replayed input
      this.predictTick(this.pending[i]);
    }

    // Don't jump: remember the difference and fade it out (unless it's a big jump like a teleport).
    const me = this.predictedMe();
    if (!me || !oldPos) return;
    const dx = oldPos.x - me.x;
    const dy = oldPos.y - me.y;
    if (Math.hypot(dx, dy) < 80) {
      this.correction.x += dx;
      this.correction.y += dy;
    } else this.correction = { x: 0, y: 0 };
  }

  /**
   * What to draw: the opponent's side ~interpDelay in the past (blended between two
   * snapshots), our own side from the prediction (now).
   */
  renderState(alpha: number): { world: World; prev: Map<number, Pos>; alpha: number } {
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
    const prev = new Map<number, Pos>();
    for (const list of [sa.fighters, sa.projectiles, sa.objects]) for (const e of list) prev.set(e.id, { x: e.x, y: e.y });

    const world = worldFromSnapshot(sb);
    world.fighters = sb.fighters.map((f) => ({ ...f, name: f.side === MY_SIDE ? 'You' : 'Opponent' }));

    if (this.pred && this.latest) {
      // Predicted things are blended between the last two local ticks here (the renderer's
      // blend factor is for the snapshots), with prev = the same spot so the renderer leaves them alone.
      const place = <T extends { id: number; x: number; y: number }>(e: T): T => {
        const p = this.predPrev.get(e.id);
        const x = p ? p.x + (e.x - p.x) * alpha : e.x;
        const y = p ? p.y + (e.y - p.y) * alpha : e.y;
        prev.set(e.id, { x, y });
        return { ...e, x, y };
      };
      const id = this.myId;
      world.projectiles = mergeOwn(world.projectiles, this.pred.projectiles, id).map((e) => (e.ownerId === id ? place(e) : e));
      world.objects = mergeOwn(world.objects, this.pred.objects, id).map((e) => (e.ownerId === id ? place(e) : e));
      world.placeables = mergeOwn(world.placeables, this.pred.placeables, id);

      // Our own character: predicted position and state, but HP from the host.
      const fresh = this.latest.fighters.find((f) => f.id === id);
      const mine = this.predictedMe();
      if (fresh && mine) {
        const fade = Math.exp(-frameDt * 15);
        this.correction.x *= fade;
        this.correction.y *= fade;
        const placed = place(mine);
        const me: Fighter = { ...placed, name: 'You', hp: fresh.hp, maxHp: fresh.maxHp, x: placed.x + this.correction.x, y: placed.y + this.correction.y };
        prev.set(id, { x: me.x, y: me.y });
        world.fighters = world.fighters.map((f) => (f.id === id ? me : f));
      }
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

/**
 * Combine the past (snapshot) list with our predicted things:
 *  - ours come from the prediction (including enemy shots our shield just reflected)
 *  - ours that the prediction says are already gone (hit something) are hidden
 *  - everything else comes from the snapshot
 */
function mergeOwn<T extends { id: number; ownerId: number }>(past: T[], predicted: T[], myId: number): T[] {
  const mine = predicted.filter((e) => e.ownerId === myId);
  const mineIds = new Set(mine.map((e) => e.id));
  const allIds = new Set(predicted.map((e) => e.id));
  const kept = past.filter((e) => !mineIds.has(e.id) && !(e.ownerId === myId && !allIds.has(e.id)));
  return [...kept, ...mine];
}
