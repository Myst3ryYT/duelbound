/**
 * Placeholder pixel art, drawn in code.
 *
 * Each placeholder is painted on a tiny canvas (e.g. 20 x 20 pixels) and then
 * scaled up in game with smoothing off, which gives the chunky pixel look.
 * Real art dropped into public/art/ replaces these automatically (see config/assets.ts).
 * Sprites that rotate face to the RIGHT.
 */
import type { SpriteId } from '../config/assets.ts';

/** A tiny pixel painter. */
class Pixels {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
  }
  px(x: number, y: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  }
  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }
  /** Filled circle centred on (cx, cy). Use .5 centres for even-sized circles. */
  disc(cx: number, cy: number, r: number, color: string): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) this.px(x, y, color);
      }
  }
}

/** Deterministic "random" so placeholder textures look the same every time. */
function noise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function fighterDefault(): HTMLCanvasElement {
  const p = new Pixels(20, 20);
  p.rect(13, 9, 7, 2, '#2a2a33'); // arm / weapon pointing right
  p.disc(10, 10, 8, '#1c1c24'); // outline
  p.disc(10, 10, 7, '#8a8fa3'); // shoulders
  p.disc(10, 10, 4, '#c9cddb'); // head
  p.rect(12, 8, 2, 1, '#1c1c24'); // eyes looking right
  p.rect(12, 11, 2, 1, '#1c1c24');
  return p.canvas;
}

function dummy(): HTMLCanvasElement {
  const p = new Pixels(20, 20);
  p.disc(10, 10, 9, '#3b2a1a'); // outline
  p.disc(10, 10, 8, '#d9b36c'); // straw
  p.disc(10, 10, 6, '#b8322f'); // red ring
  p.disc(10, 10, 4, '#e8d9b0');
  p.disc(10, 10, 2, '#b8322f'); // bullseye
  return p.canvas;
}

function floorTile(): HTMLCanvasElement {
  const p = new Pixels(16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const n = noise(x, y, 1);
      p.px(x, y, n > 0.92 ? '#3a3d4a' : n > 0.5 ? '#2c2f3a' : '#292b36');
    }
  p.rect(0, 0, 16, 1, '#24262f'); // tile seams
  p.rect(0, 0, 1, 16, '#24262f');
  return p.canvas;
}

function wallTile(): HTMLCanvasElement {
  const p = new Pixels(8, 8);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) p.px(x, y, noise(x, y, 7) > 0.6 ? '#5b5e70' : '#4b4e5e');
  p.rect(0, 0, 8, 1, '#7a7e93');
  p.rect(0, 7, 8, 1, '#30323d');
  return p.canvas;
}

function crosshair(): HTMLCanvasElement {
  const p = new Pixels(15, 15);
  const c = '#ffffff';
  const o = '#000000';
  // outline first, then white lines on top
  p.rect(6, 0, 3, 6, o);
  p.rect(6, 9, 3, 6, o);
  p.rect(0, 6, 6, 3, o);
  p.rect(9, 6, 6, 3, o);
  p.rect(7, 1, 1, 4, c);
  p.rect(7, 10, 1, 4, c);
  p.rect(1, 7, 4, 1, c);
  p.rect(10, 7, 4, 1, c);
  p.px(7, 7, c); // centre dot
  return p.canvas;
}

/** One placeholder per sprite id. Adding a sprite? Add its painter here too. */
export const PLACEHOLDERS: Record<SpriteId, () => HTMLCanvasElement> = {
  fighter_default: fighterDefault,
  dummy,
  floor_tile: floorTile,
  wall_tile: wallTile,
  crosshair,
};
