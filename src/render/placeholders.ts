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
  // One piece of the curved wall, lying flat (stretched along its length in game).
  const p = new Pixels(24, 4);
  p.rect(0, 0, 24, 4, 'rgba(90,160,255,0.55)');
  p.rect(0, 1, 24, 2, 'rgba(170,210,255,0.95)');
  for (let x = 3; x < 24; x += 8) p.px(x, 1, GOLD);
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

// --------------------------------------------------------------- SHERIFF ----
const BROWN = '#7a4b22';
const BROWN_DARK = '#4a2c12';
const BROWN_LIGHT = '#a8703a';
const RED = '#b8322f';
const STEEL = '#9aa3b5';

function sheriff(): HTMLCanvasElement {
  const p = new Pixels(20, 20);
  p.rect(12, 11, 7, 2, STEEL); // revolver pointing right
  p.rect(12, 13, 2, 1, BROWN_DARK); // grip
  p.disc(10, 10, 8, OUTLINE);
  p.disc(10, 10, 7, RED); // shirt / shoulders
  p.disc(10, 10, 6.2, BROWN_LIGHT); // hat brim, seen from above
  p.ring(10, 10, 6.2, 1, BROWN_DARK);
  p.disc(10, 10, 3.6, BROWN); // hat crown
  p.rect(9, 9, 3, 2, BROWN_DARK); // crown dent
  p.px(15, 10, '#ffd34d'); // star badge peeking out
  return p.canvas;
}

function sheriffBullet(): HTMLCanvasElement {
  const p = new Pixels(10, 6);
  p.rect(0, 2, 4, 2, 'rgba(255,200,80,0.5)'); // streak behind
  p.rect(3, 1, 5, 4, '#e0b030');
  p.rect(8, 2, 2, 2, '#fff1b0');
  return p.canvas;
}

function sheriffLasso(): HTMLCanvasElement {
  const p = new Pixels(12, 12);
  p.ring(6, 6, 6, 1.6, '#d8b880');
  p.ring(6, 6, 4.4, 0.8, BROWN_LIGHT);
  return p.canvas;
}

function sheriffBramble(): HTMLCanvasElement {
  const p = new Pixels(16, 16);
  p.disc(8, 8, 8, 'rgba(90,60,20,0.35)');
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7;
    p.line(8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, 8 - Math.cos(a + 1.9) * 6, 8 - Math.sin(a + 1.9) * 6, i % 2 ? '#a07a40' : '#c8a060');
  }
  p.ring(8, 8, 8, 1, '#6b4a20');
  return p.canvas;
}

function dummyShot(): HTMLCanvasElement {
  const p = new Pixels(10, 10);
  p.disc(5, 5, 5, 'rgba(184,50,47,0.5)');
  p.disc(5, 5, 3.5, '#e05050');
  p.disc(5, 5, 1.5, '#ffe0d0');
  return p.canvas;
}

function iconGun(): HTMLCanvasElement {
  const p = iconBase(BROWN_DARK);
  p.rect(3, 6, 9, 2, STEEL); // barrel
  p.rect(6, 5, 4, 4, '#6a7385'); // cylinder
  p.rect(4, 8, 3, 5, BROWN_LIGHT); // grip
  p.px(12, 6, '#fff');
  return p.canvas;
}
function iconLasso(): HTMLCanvasElement {
  const p = iconBase(BROWN_DARK);
  p.ring(10, 6, 4, 1.2, '#d8b880');
  p.line(3, 13, 7, 9, '#d8b880');
  return p.canvas;
}
function iconBramble(): HTMLCanvasElement {
  const p = iconBase(BROWN_DARK);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05;
    p.line(8 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, 8 - Math.cos(a + 2) * 5, 8 - Math.sin(a + 2) * 5, '#c8a060');
  }
  return p.canvas;
}
function iconHorse(): HTMLCanvasElement {
  const p = iconBase(BROWN_DARK);
  p.rect(3, 7, 9, 4, '#a0643a'); // body
  p.rect(11, 4, 3, 5, '#a0643a'); // neck and head
  p.rect(3, 11, 1, 3, '#7a4a2a'); // legs
  p.rect(10, 11, 1, 3, '#7a4a2a');
  p.rect(2, 7, 1, 3, '#5e3820'); // tail
  return p.canvas;
}
function iconRoll(): HTMLCanvasElement {
  const p = iconBase(BROWN_DARK);
  p.ring(9, 8, 4.5, 1.2, BROWN_LIGHT);
  p.line(2, 6, 4, 6, '#c9cddb'); // speed lines
  p.line(1, 9, 4, 9, '#c9cddb');
  p.line(2, 12, 4, 12, '#c9cddb');
  return p.canvas;
}

// ------------------------------------------------------------- REFRACTOR ----
const GLASS = 'rgba(190,235,255,0.85)';
const GLASS_DARK = '#4a8fb8';
const MAGENTA = '#e05ad0';
const CYAN = '#5ae0e8';

function refractor(): HTMLCanvasElement {
  const p = new Pixels(20, 20);
  p.disc(10, 10, 8, OUTLINE);
  p.disc(10, 10, 7, GLASS_DARK); // shoulders
  p.disc(10, 10, 5.5, GLASS); // glassy head
  for (let i = 0; i < 4; i++) p.line(6 + i, 6 + i * 2, 10 + i, 5 + i * 2, 'rgba(255,255,255,0.6)'); // facets
  p.rect(13, 8, 3, 1, MAGENTA); // prism "eyes" looking right
  p.rect(13, 11, 3, 1, CYAN);
  p.px(10, 4, '#ffffff');
  return p.canvas;
}

function refractorPellet(): HTMLCanvasElement {
  const p = new Pixels(8, 8);
  p.disc(4, 4, 4, 'rgba(197,140,255,0.5)');
  p.disc(4, 4, 2.6, '#c58cff');
  p.disc(4, 4, 1.2, '#ffffff');
  return p.canvas;
}

function refractorMirror(): HTMLCanvasElement {
  // Lying flat, left to right; stretched along the mirror's length in game.
  const p = new Pixels(32, 4);
  p.rect(0, 0, 32, 4, OUTLINE);
  p.rect(0, 1, 32, 2, GLASS);
  for (let x = 2; x < 32; x += 7) p.px(x, 1, '#ffffff');
  return p.canvas;
}

function iconShotgun(): HTMLCanvasElement {
  const p = iconBase('#2a2440');
  p.disc(4, 8, 2, GLASS);
  for (const dy of [-3, -1, 1, 3]) p.line(6, 8, 13, 8 + dy, '#c58cff');
  return p.canvas;
}
function iconRay(): HTMLCanvasElement {
  const p = iconBase('#2a2440');
  p.line(2, 13, 8, 4, '#c58cff');
  p.line(8, 4, 14, 12, '#e8c8ff');
  p.rect(7, 3, 3, 1, GLASS); // mirror at the bounce
  return p.canvas;
}
function iconMirror(): HTMLCanvasElement {
  const p = iconBase('#2a2440');
  p.line(3, 12, 12, 3, GLASS);
  p.line(4, 12, 13, 3, GLASS_DARK);
  p.px(7, 8, '#fff');
  return p.canvas;
}
function iconDash(): HTMLCanvasElement {
  const p = iconBase('#2a2440');
  p.disc(10.5, 8, 3, GLASS);
  p.line(1, 6, 6, 6, MAGENTA); // speed lines
  p.line(2, 8, 7, 8, CYAN);
  p.line(1, 10, 6, 10, MAGENTA);
  return p.canvas;
}
function iconShatter(): HTMLCanvasElement {
  const p = iconBase('#2a2440');
  p.line(8, 8, 3, 3, GLASS);
  p.line(8, 8, 13, 4, GLASS);
  p.line(8, 8, 12, 13, GLASS);
  p.line(8, 8, 3, 12, GLASS);
  p.px(8, 8, '#fff');
  return p.canvas;
}

// --------------------------------------------------------------- BUILDER ----
const ORANGE = '#f0902a';
const ORANGE_DARK = '#a85a12';
const BRICK = '#b04a32';
const BRICK_DARK = '#6e2a1c';
const WOOD = '#9a6a3a';
const WOOD_DARK = '#5e3c1e';

function builder(): HTMLCanvasElement {
  const p = new Pixels(20, 20);
  p.rect(12, 14, 7, 2, '#7a7f8c'); // hammer handle held forward
  p.rect(17, 12, 3, 6, '#5b5e70'); // hammer head
  p.disc(10, 10, 8, OUTLINE);
  p.disc(10, 10, 7, '#3d5a8a'); // overalls / shoulders
  p.rect(6, 4, 2, 12, ORANGE); // hi-vis straps
  p.rect(12, 4, 2, 12, ORANGE);
  p.disc(10, 10, 4.8, ORANGE_DARK); // hard hat rim
  p.disc(10, 10, 4, ORANGE); // hard hat
  p.rect(9, 6, 2, 8, '#ffd08a'); // ridge
  p.px(14, 10, OUTLINE); // brim facing right
  return p.canvas;
}
function builderNail(): HTMLCanvasElement {
  const p = new Pixels(8, 4);
  p.rect(0, 1, 6, 2, '#c9cddb');
  p.rect(6, 1, 2, 2, '#ffffff');
  p.rect(0, 0, 1, 4, '#9aa3b5'); // head
  return p.canvas;
}
function builderBrick(): HTMLCanvasElement {
  const p = new Pixels(10, 8);
  p.rect(0, 0, 10, 8, BRICK_DARK);
  p.rect(1, 1, 8, 6, BRICK);
  p.rect(1, 3, 8, 1, '#d8a080'); // mortar line
  return p.canvas;
}
function builderWall(): HTMLCanvasElement {
  // Lying flat, left to right; stretched along the wall's length in game.
  const p = new Pixels(32, 6);
  p.rect(0, 0, 32, 6, BRICK_DARK);
  for (let row = 0; row < 2; row++)
    for (let x = row * 3; x < 32; x += 6) p.rect(x + 1, 1 + row * 2.5, 4, 2, BRICK);
  return p.canvas;
}
function furnitureChair(): HTMLCanvasElement {
  const p = new Pixels(16, 16);
  p.rect(2, 2, 12, 12, OUTLINE);
  p.rect(3, 3, 10, 10, WOOD); // seat
  p.rect(3, 3, 3, 10, WOOD_DARK); // backrest
  p.rect(7, 6, 5, 4, '#b8864e');
  return p.canvas;
}
function furnitureTable(): HTMLCanvasElement {
  const p = new Pixels(16, 16);
  p.disc(8, 8, 7.5, OUTLINE);
  p.disc(8, 8, 6.5, WOOD);
  p.ring(8, 8, 6.5, 1, WOOD_DARK);
  p.line(4, 8, 12, 8, WOOD_DARK); // planks
  p.disc(6, 6, 1, '#e8e0d0'); // a cup
  return p.canvas;
}
function furnitureCouch(): HTMLCanvasElement {
  const p = new Pixels(16, 16);
  p.rect(1, 2, 14, 12, OUTLINE);
  p.rect(2, 3, 12, 10, '#5a8a4a'); // cushions
  p.rect(2, 3, 3, 10, '#3e6a32'); // back
  p.rect(2, 3, 12, 2, '#3e6a32'); // arms
  p.rect(2, 11, 12, 2, '#3e6a32');
  p.line(5, 8, 13, 8, '#3e6a32');
  return p.canvas;
}
function iconNailgun(): HTMLCanvasElement {
  const p = iconBase('#3a2a1a');
  p.rect(2, 6, 8, 4, ORANGE);
  p.rect(4, 10, 3, 4, ORANGE_DARK); // grip
  for (const x of [11, 13]) p.rect(x, 7, 1, 2, '#c9cddb'); // nails
  return p.canvas;
}
function iconHammer(): HTMLCanvasElement {
  const p = iconBase('#3a2a1a');
  p.line(3, 13, 10, 6, WOOD);
  p.rect(8, 2, 6, 5, '#7a7f8c');
  p.rect(8, 2, 6, 1, '#c9cddb');
  return p.canvas;
}
function iconWall(): HTMLCanvasElement {
  const p = iconBase('#3a2a1a');
  for (let row = 0; row < 3; row++) for (let x = (row % 2) * 2 + 1; x < 14; x += 4) p.rect(x, 3 + row * 4, 3, 3, BRICK);
  return p.canvas;
}
function iconConstruction(): HTMLCanvasElement {
  const p = iconBase('#3a2a1a');
  p.rect(3, 5, 10, 7, WOOD); // a chair-ish box
  p.rect(3, 5, 3, 7, WOOD_DARK);
  p.line(10, 2, 13, 2, '#ffd34d'); // sparkle
  p.line(12, 1, 12, 3, '#ffd34d');
  return p.canvas;
}
function iconBuilderDash(): HTMLCanvasElement {
  const p = iconBase('#3a2a1a');
  p.disc(10.5, 8, 3, ORANGE);
  p.line(1, 6, 6, 6, '#c9cddb');
  p.line(2, 8, 7, 8, '#c9cddb');
  p.line(1, 10, 6, 10, '#c9cddb');
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
  mage_watchtower: mageWatchtower,
  mage_shield: mageShield,
  teleport_marker: teleportMarker,
  icon_mage_staff: iconStaff,
  icon_mage_shield: iconShield,
  icon_mage_watchtower: iconWatchtower,
  icon_mage_switch: iconSwitch,
  icon_mage_teleport: iconTeleport,
  class_sheriff: sheriff,
  sheriff_bullet: sheriffBullet,
  sheriff_lasso: sheriffLasso,
  sheriff_bramble: sheriffBramble,
  dummy_shot: dummyShot,
  icon_sheriff_gun: iconGun,
  icon_sheriff_lasso: iconLasso,
  icon_sheriff_bramble: iconBramble,
  icon_sheriff_horse: iconHorse,
  icon_sheriff_roll: iconRoll,
  class_refractor: refractor,
  refractor_pellet: refractorPellet,
  refractor_mirror: refractorMirror,
  icon_refractor_shotgun: iconShotgun,
  icon_refractor_ray: iconRay,
  icon_refractor_mirror: iconMirror,
  icon_refractor_dash: iconDash,
  icon_refractor_shatter: iconShatter,
  class_builder: builder,
  builder_nail: builderNail,
  builder_brick: builderBrick,
  builder_wall: builderWall,
  builder_furniture_chair: furnitureChair,
  builder_furniture_table: furnitureTable,
  builder_furniture_couch: furnitureCouch,
  icon_builder_nailgun: iconNailgun,
  icon_builder_hammer: iconHammer,
  icon_builder_wall: iconWall,
  icon_builder_construction: iconConstruction,
  icon_builder_dash: iconBuilderDash,
};
