/**
 * Small network overlay (top-right) for online matches: ping, snapshot rate,
 * data use and input buffer. Switched on in the dev panel's "Network test" section.
 */
import { NET_DEBUG, NET_STATS } from '../net/netDebug.ts';
import { netBytes } from '../platform/peer.ts';

export class NetOverlay {
  private root: HTMLDivElement;
  private lastBytes = { in: 0, out: 0, at: performance.now() };
  private rates = { in: 0, out: 0 };

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'net-overlay';
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  /** Call every frame. `online` = an online match is running. */
  update(online: boolean): void {
    this.root.hidden = !(online && NET_DEBUG.overlay);
    if (this.root.hidden) return;
    const now = performance.now();
    if (now - this.lastBytes.at >= 1000) {
      const secs = (now - this.lastBytes.at) / 1000;
      this.rates = { in: (netBytes.in - this.lastBytes.in) / secs / 1024, out: (netBytes.out - this.lastBytes.out) / secs / 1024 };
      this.lastBytes = { in: netBytes.in, out: netBytes.out, at: now };
    }
    const s = NET_STATS;
    const fake = NET_DEBUG.latencyMs || NET_DEBUG.jitterMs || NET_DEBUG.lossPct ? `\nFAKE LAG ON: +${NET_DEBUG.latencyMs}ms ±${NET_DEBUG.jitterMs}ms, ${NET_DEBUG.lossPct}% loss` : '';
    this.root.textContent =
      `${s.role.toUpperCase()}  ping ${Math.round(s.pingMs)} ms\n` +
      `snapshots ${s.role === 'host' ? 'sent' : 'received'}: ${s.snapshotsPerSec}/s\n` +
      `${s.role === 'host' ? 'guest inputs waiting' : 'inputs not yet confirmed'}: ${s.inputBuffer}\n` +
      `fast data in ${this.rates.in.toFixed(1)} kB/s, out ${this.rates.out.toFixed(1)} kB/s` +
      fake;
  }
}
