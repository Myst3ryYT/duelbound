/**
 * The view: the game is laid out on a fixed 1920 x 1080 "screen", which is
 * scaled to fit the browser window (black bars fill any leftover space).
 * The arena sits in the middle of that screen.
 */
import { ART_PIXEL } from '../config/assets.ts';

export const SCREEN_W = 1920;
export const SCREEN_H = 1080;

export class View {
  scale = 1; // window pixels per screen unit
  offsetX = 0; // where the 1920x1080 area starts in the window (CSS pixels)
  offsetY = 0;
  arenaSize = 960;

  constructor(private canvas: HTMLCanvasElement) {}

  /** Resize the canvas backing store to the window (call every frame; cheap if unchanged). */
  fit(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
    }
    // Zoom in whole steps, so one art pixel (4 world units) is always a whole number of screen pixels.
    // The leftover window space becomes black bars.
    const fit = Math.min(w / SCREEN_W, h / SCREEN_H);
    const step = 1 / (ART_PIXEL * dpr);
    this.scale = Math.max(step, Math.floor(fit / step) * step);
    this.offsetX = (w - SCREEN_W * this.scale) / 2;
    this.offsetY = (h - SCREEN_H * this.scale) / 2;
  }

  /** Top-left of the arena in screen units. */
  get arenaX(): number {
    return (SCREEN_W - this.arenaSize) / 2;
  }
  get arenaY(): number {
    return (SCREEN_H - this.arenaSize) / 2;
  }

  /** Browser mouse position -> 1920x1080 screen units. */
  clientToScreen = (clientX: number, clientY: number): { x: number; y: number } => {
    const r = this.canvas.getBoundingClientRect();
    return { x: (clientX - r.left - this.offsetX) / this.scale, y: (clientY - r.top - this.offsetY) / this.scale };
  };

  /** Screen units -> world (arena) units. */
  screenToWorld = (sx: number, sy: number): { x: number; y: number } => {
    return { x: sx - this.arenaX, y: sy - this.arenaY };
  };
}
