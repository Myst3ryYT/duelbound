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
  /** Circle outline between radius r-thick and r. */
  ring(cx: number, cy: number, r: number, thick: number, color: string): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r && d > r - thick) this.px(x, y, color);
      }
  }
  /** One-pixel line from (x0, y0) to (x1, y1). */
  line(x0: number, y0: number, x1: number, y1: number, color: string): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, color);
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

// ------------------------------------------------------------------ MAGE ----
const GOLD = '#ffd34d';
const GOLD_DARK = '#b8860b';
const BLUE = '#3d6fe0';
const BLUE_DARK = '#1f3a8a';
const BLUE_LIGHT = '#7fb0ff';
const OUTLINE = '#10121c';

function mage(): HTMLCanvasElement {
  const p = new Pixels(20, 20);
  p.rect(9, 15, 10, 1, '#7a4b22'); // staff held forward
  p.disc(18.5, 15.5, 1.8, GOLD); // staff orb
  p.disc(10, 10, 8, OUTLINE);
  p.disc(10, 10, 7, BLUE); // robe / shoulders
  p.ring(10, 10, 7, 1, GOLD_DARK); // gold trim
  p.disc(10, 10, 4.5, BLUE_DARK); // hood
  p.disc(11, 10, 2.5, '#f0d0a8'); // face peeking out, looking right
  p.px(12, 9, OUTLINE);
  p.px(12, 11, OUTLINE);
  p.rect(4, 9, 3, 2, GOLD); // emblem on the back
  return p.canvas;
}

function mageBolt(): HTMLCanvasElement {
  const p = new Pixels(10, 10);
  p.disc(5, 5, 5, 'rgba(61,111,224,0.55)'); // glow
  p.disc(5, 5, 3.6, BLUE_LIGHT);
  p.disc(5, 5, 2.2, GOLD);
  p.disc(5, 5, 1, '#ffffff');
  return p.canvas;
}

function mageTowerBolt(): HTMLCanvasElement {
  const p = new Pixels(10, 10);
  p.disc(5, 5, 5, 'rgba(255,211,77,0.5)');
  p.disc(5, 5, 3.6, GOLD);
  p.disc(5, 5, 2, BLUE_LIGHT);
  return p.canvas;
}

function mageWatchtower(): HTMLCanvasElement {
  const p = new Pixels(20, 20);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    p.disc(10 + Math.cos(a) * 8, 10 + Math.sin(a) * 8, 1.6, GOLD_DARK); // 8 turrets
  }
  p.disc(10, 10, 8, OUTLINE);
  p.disc(10, 10, 7, '#5b5e70'); // stone
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) if (noise(x, y, 3) > 0.8 && Math.hypot(x - 9.5, y - 9.5) < 6.5) p.px(x, y, '#4b4e5e');
  p.disc(10, 10, 4.5, BLUE_DARK);
  p.disc(10, 10, 3, BLUE);
  p.disc(10, 10, 1.6, GOLD); // crystal
  return p.canvas;
}

function mageShield(): HTMLCanvasElement {
  const p = new Pixels(24, 24);
  p.disc(12, 12, 12, 'rgba(90,160,255,0.18)');
  p.ring(12, 12, 12, 1.5, 'rgba(150,200,255,0.9)');
  p.ring(12, 12, 10.5, 1, 'rgba(90,160,255,0.45)');
  p.rect(6, 6, 2, 1, 'rgba(255,255,255,0.8)'); // shine
  p.rect(5, 7, 1, 2, 'rgba(255,255,255,0.8)');
  return p.canvas;
}

function teleportMarker(): HTMLCanvasElement {
  const p = new Pixels(14, 14);
  p.ring(7, 7, 7, 1, BLUE_LIGHT);
  p.ring(7, 7, 4, 1, GOLD);
  p.px(6, 6, '#fff');
  p.px(7, 7, '#fff');
  return p.canvas;
}

// ---- Ability icons (16 x 16) ----
function iconBase(bg: string): Pixels {
  const p = new Pixels(16, 16);
  p.rect(0, 0, 16, 16, OUTLINE);
  p.rect(1, 1, 14, 14, bg);
  return p;
}
function iconStaff(): HTMLCanvasElement {
  const p = iconBase(BLUE_DARK);
  p.line(3, 13, 11, 5, '#a0703a');
  p.disc(12, 4, 2.2, GOLD);
  p.px(12, 3, '#fff');
  return p.canvas;
}
function iconShield(): HTMLCanvasElement {
  const p = iconBase(BLUE_DARK);
  p.ring(8, 8, 6, 1.5, BLUE_LIGHT);
  p.line(3, 3, 6, 6, GOLD); // incoming arrow bouncing off
  p.line(6, 6, 3, 9, GOLD);
  return p.canvas;
}
function iconWatchtower(): HTMLCanvasElement {
  const p = iconBase(BLUE_DARK);
  p.line(8, 2, 8, 14, GOLD_DARK);
  p.line(2, 8, 14, 8, GOLD_DARK);
  p.line(3, 3, 13, 13, GOLD_DARK);
  p.line(13, 3, 3, 13, GOLD_DARK);
  p.disc(8, 8, 3.5, '#5b5e70');
  p.disc(8, 8, 1.6, GOLD);
  return p.canvas;
}
function iconSwitch(): HTMLCanvasElement {
  const p = iconBase(BLUE_DARK);
  p.line(3, 5, 12, 5, GOLD); // arrow right
  p.line(10, 3, 12, 5, GOLD);
  p.line(10, 7, 12, 5, GOLD);
  p.line(4, 11, 13, 11, BLUE_LIGHT); // arrow left
  p.line(4, 11, 6, 9, BLUE_LIGHT);
  p.line(4, 11, 6, 13, BLUE_LIGHT);
  return p.canvas;
}
function iconTeleport(): HTMLCanvasElement {
  const p = iconBase(BLUE_DARK);
  p.ring(5, 10, 3, 1, BLUE_LIGHT);
  p.ring(11, 5, 3, 1, GOLD);
  for (const [x, y] of [[7, 8], [8, 7], [9, 6]]) p.px(x, y, '#fff');
  return p.canvas;
}

/** One placeholder per sprite id. Adding a sprite? Add its painter here too. */
export const PLACEHOLDERS: Record<SpriteId, () => HTMLCanvasElement> = {
  fighter_default: fighterDefault,
  dummy,
  floor_tile: floorTile,
  wall_tile: wallTile,
  crosshair,
  class_mage: mage,
  mage_bolt: mageBolt,
  mage_tower_bolt: mageTowerBolt,
  mage_watchtower: mageWatchtower,
  mage_shield: mageShield,
  teleport_marker: teleportMarker,
  icon_mage_staff: iconStaff,
  icon_mage_shield: iconShield,
  icon_mage_watchtower: iconWatchtower,
  icon_mage_switch: iconSwitch,
  icon_mage_teleport: iconTeleport,
};
