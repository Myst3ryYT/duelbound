/**
 * Network testing tools (step 6 of the brief):
 *  - fake latency, jitter and packet loss, to see how the game feels on a bad connection
 *    even when both windows are on the same computer
 *  - numbers for the network overlay (ping, snapshot rate...)
 *
 * The settings are changed from the dev panel's "Network test" section.
 * They only affect THIS window. "Latency" is added to the round trip
 * (half on the way out, half on the way in).
 */
import type { NetLink } from '../platform/peer.ts';

export const NET_DEBUG = {
  latencyMs: 0, // extra round-trip delay (0..200)
  jitterMs: 0, // extra random delay per message, 0..this
  lossPct: 0, // % of fast messages (snapshots / inputs) dropped, each direction
  overlay: false, // show the ping / snapshot overlay
};

/** Live numbers for the overlay. Filled in by the online sessions and controllers. */
export const NET_STATS = {
  role: '' as '' | 'host' | 'guest',
  pingMs: 0,
  snapshotsPerSec: 0, // sent (host) or received (guest)
  inputBuffer: 0, // host: guest inputs waiting; guest: inputs the host hasn't confirmed yet
};

/** Count events per second (snapshots). */
export class RateCounter {
  private times: number[] = [];
  hit(): void {
    const now = performance.now();
    this.times.push(now);
    while (this.times.length && this.times[0] < now - 1000) this.times.shift();
  }
  get perSecond(): number {
    const now = performance.now();
    while (this.times.length && this.times[0] < now - 1000) this.times.shift();
    return this.times.length;
  }
}

/** Wraps a real link and adds the fake delay / loss from NET_DEBUG. */
export class DebugLink implements NetLink {
  onMessage: (msg: unknown, fast: boolean) => void = () => {};
  onClose: () => void = () => {};
  private inner: NetLink;
  private lastReliableOut = 0; // reliable messages must stay in order even with jitter
  private lastReliableIn = 0;

  constructor(inner: NetLink) {
    this.inner = inner;
    inner.onMessage = (msg, fast) => this.later(fast, true, () => this.onMessage(msg, fast));
    inner.onClose = () => this.onClose();
  }

  get open(): boolean {
    return this.inner.open;
  }
  send(msg: unknown): void {
    this.later(false, false, () => this.inner.send(msg));
  }
  sendFast(msg: unknown): void {
    this.later(true, false, () => this.inner.sendFast(msg));
  }
  close(): void {
    this.inner.close();
  }

  /** Run `fn` after the fake delay (or drop it, for lossy messages). */
  private later(fast: boolean, incoming: boolean, fn: () => void): void {
    const d = NET_DEBUG;
    if (d.latencyMs <= 0 && d.jitterMs <= 0 && d.lossPct <= 0) return fn();
    if (fast && Math.random() * 100 < d.lossPct) return; // lost
    let at = performance.now() + d.latencyMs / 2 + Math.random() * d.jitterMs;
    if (!fast) {
      // Keep reliable messages in order.
      if (incoming) at = this.lastReliableIn = Math.max(at, this.lastReliableIn);
      else at = this.lastReliableOut = Math.max(at, this.lastReliableOut);
    }
    setTimeout(fn, Math.max(0, at - performance.now()));
  }
}
