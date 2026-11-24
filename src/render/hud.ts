/**
 * The HUD: HP bars across the top, ability icons with cooldowns, and help text.
 * Everything here is in 1920x1080 screen units. The arena fills the middle,
 * so the ability bar and help text sit in the empty space on the left.
 */
import type { Fighter, World } from '../sim/types.ts';
import { findSprite } from './sprites.ts';
import { SCREEN_H, SCREEN_W } from './view.ts';

/** One ability slot on the HUD. */
export interface HudAbility {
  icon: string; // sprite id
  name: string;
  key: string; // key label, e.g. "C"
  cooldown: number; // seconds left
  total: number; // full cooldown length
  active: boolean; // highlighted (e.g. currently placing it)
  count?: number; // ammo, shown in the corner
  charges?: number; // stored uses (abilities with charges)
  chargeMax?: number;
  ready: boolean; // can be used right now
  disabled?: boolean; // switched off: drawn greyed out
}

/** Extra things the game screen wants shown. */
export interface HudInfo {
  helpLines: string[]; // shown bottom-left, above the ability bar
  abilities: HudAbility[];
  roundTimeTotal: number; // full round clock (for the "FIGHT!" flash)
  roundsToWin: number; // number of round-win pips under each HP bar
  banner?: string | null; // a notice across the screen (e.g. opponent disconnected)
}

const BAR_W = 780;
const BAR_H = 30;
const BAR_Y = 14;
const BAR_MARGIN = 60;

// Ability icons: two rows (3 + 2) in the empty space left of the arena.
const ICON = 104;
const ICON_GAP = 16;
const ICONS_X = 30;
const ICON_ROW_H = ICON + 44; // icon + its name underneath
const ICONS_Y = SCREEN_H - 2 * ICON_ROW_H - 10; // top of the first row

export function drawHud(ctx: CanvasRenderingContext2D, world: World, info: HudInfo, trailHpOf: (id: number) => number): void {
  for (const f of world.fighters) drawHpBar(ctx, f, trailHpOf(f.id));
  drawAbilityBar(ctx, info.abilities);
  drawMatch(ctx, world, info);
  if (info.banner) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 120, SCREEN_W, 70);
    outlinedText(ctx, info.banner, SCREEN_W / 2, 155, 'bold 34px monospace', '#ff9a6a', 'center');
  }

  ctx.font = '18px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8a8fa3';
  info.helpLines.forEach((line, i) => {
    ctx.fillText(line, ICONS_X, ICONS_Y - 30 - (info.helpLines.length - 1 - i) * 26);
  });
}

/** Round clock, round-win pips, and the big countdown / result text. */
function drawMatch(ctx: CanvasRenderingContext2D, world: World, info: HudInfo): void {
  const m = world.match;
  if (!m) return;

  // Clock between the HP bars
  const clockX = SCREEN_W / 2;
  ctx.fillStyle = '#000';
  ctx.fillRect(clockX - 56, BAR_Y - 6, 112, BAR_H + 22);
  const secs = Math.ceil(m.roundTime);
  outlinedText(ctx, String(secs), clockX, BAR_Y + BAR_H / 2 + 5, 'bold 36px monospace', secs <= 10 && m.phase === 'fight' ? '#ff6a4a' : '#ffffff', 'center');

  // Round-win pips under each bar
  for (const side of [0, 1] as const) {
    for (let i = 0; i < info.roundsToWin; i++) {
      const size = 16;
      const x = side === 0 ? BAR_MARGIN + i * (size + 8) : SCREEN_W - BAR_MARGIN - size - i * (size + 8);
      const y = BAR_Y + BAR_H + 10;
      ctx.fillStyle = '#000';
      ctx.fillRect(x - 2, y - 2, size + 4, size + 4);
      ctx.fillStyle = i < m.wins[side] ? '#ffd34d' : '#2a2c36';
      ctx.fillRect(x, y, size, size);
    }
  }

  // Big centre text
  const name = (side: number) => world.fighters.find((f) => f.side === side)?.name ?? '';
  const wins = (side: number) => (name(side) === 'You' ? 'YOU WIN' : `${name(side).toUpperCase()} WINS`);
  const big = (text: string, sub?: string, color = '#ffffff') => {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, SCREEN_H / 2 - 110, SCREEN_W, sub ? 200 : 160);
    outlinedText(ctx, text, SCREEN_W / 2, SCREEN_H / 2 - 30, 'bold 96px monospace', color, 'center');
    if (sub) outlinedText(ctx, sub, SCREEN_W / 2, SCREEN_H / 2 + 50, 'bold 32px monospace', '#c9cddb', 'center');
  };
  if (m.phase === 'countdown') big(String(Math.ceil(m.phaseT)), `ROUND ${m.round}`);
  else if (m.phase === 'fight' && info.roundTimeTotal - m.roundTime < 0.7) big('FIGHT!', undefined, '#ffd34d');
  else if (m.phase === 'roundOver' && m.matchWinner < 0) big(wins(m.roundWinner), `round ${m.round}`, '#ffd34d');
  else if (m.phase === 'tie') big('TIE!', `replaying round ${m.round}`, '#7fb0ff');
  else if (m.phase === 'roundOver' || m.phase === 'matchOver') big(`${wins(m.matchWinner)} THE MATCH`, undefined, '#ffd34d');
}

/**
 * Ability icons. At a glance:
 *  - ready:        full colour with a bright frame
 *  - cooling down: dark, a sweep filling up clockwise, big seconds number, dull frame
 *  - charges:      pips along the bottom; a small timer while one is coming back
 */
function drawAbilityBar(ctx: CanvasRenderingContext2D, abilities: HudAbility[]): void {
  abilities.forEach((a, i) => {
    const row = i < 3 ? 0 : 1;
    const col = i < 3 ? i : i - 3;
    const x = ICONS_X + col * (ICON + ICON_GAP);
    const y = ICONS_Y + row * ICON_ROW_H;
    const cx = x + ICON / 2;
    const cy = y + ICON / 2;
    const cooling = !a.ready && !a.disabled;

    // Frame: bright when ready, dull while cooling down, gold while placing.
    ctx.fillStyle = a.active ? '#ffd34d' : cooling || a.disabled ? '#2a2c36' : '#e8ecf5';
    ctx.fillRect(x - 5, y - 5, ICON + 10, ICON + 10);
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 2, y - 2, ICON + 4, ICON + 4);
    const sprite = findSprite(a.icon);
    if (sprite) ctx.drawImage(sprite.image, x, y, ICON, ICON);

    if (a.disabled) {
      ctx.fillStyle = 'rgba(20,20,26,0.82)';
      ctx.fillRect(x, y, ICON, ICON);
      outlinedText(ctx, 'OFF', cx, cy + 2, 'bold 32px monospace', '#7a7f90', 'center');
    }
    const timer = (secs: number) => (secs >= 1 ? String(Math.ceil(secs)) : secs.toFixed(1));
    if (cooling) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x, y, ICON, ICON);
      // The part that has already come back is uncovered, sweeping clockwise from the top.
      if (a.total > 0) {
        const done = 1 - Math.min(1, a.cooldown / a.total);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, ICON, ICON);
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, ICON, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * done);
        ctx.closePath();
        ctx.clip();
        if (sprite) {
          ctx.globalAlpha = 0.45;
          ctx.drawImage(sprite.image, x, y, ICON, ICON);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
      if (a.cooldown > 0) outlinedText(ctx, timer(a.cooldown), cx, cy + 2, 'bold 44px monospace', '#ffffff', 'center');
    } else if (a.cooldown > 0 && a.chargeMax) {
      // Has a use ready, and another one recharging: small timer in the corner.
      outlinedText(ctx, timer(a.cooldown), x + ICON - 8, y + 16, 'bold 20px monospace', '#c9cddb', 'right');
    }

    // Charge pips along the bottom.
    if (a.chargeMax) {
      const size = 14;
      const gap = 6;
      const total = a.chargeMax * size + (a.chargeMax - 1) * gap;
      for (let k = 0; k < a.chargeMax; k++) {
        const px = cx - total / 2 + k * (size + gap);
        const py = y + ICON - size - 6;
        ctx.fillStyle = '#000';
        ctx.fillRect(px - 2, py - 2, size + 4, size + 4);
        ctx.fillStyle = k < (a.charges ?? 0) ? '#7fe0ff' : '#2a2c36';
        ctx.fillRect(px, py, size, size);
      }
    }
    if (a.count !== undefined) outlinedText(ctx, String(a.count), x + ICON - 8, y + 18, 'bold 24px monospace', '#ffe27a', 'right');

    // Key badge (top-left) and name underneath.
    ctx.fillStyle = '#000';
    const keyW = Math.max(30, a.key.length * 13 + 12);
    ctx.fillRect(x - 6, y - 6, keyW, 28);
    outlinedText(ctx, a.key, x - 6 + keyW / 2, y + 8, 'bold 18px monospace', '#ffd34d', 'center');
    // Long names get a smaller font so they don't run into the next icon.
    let size = 16;
    ctx.font = `bold ${size}px monospace`;
    while (size > 10 && ctx.measureText(a.name).width > ICON + ICON_GAP - 4) ctx.font = `bold ${--size}px monospace`;
    outlinedText(ctx, a.name, cx, y + ICON + 22, `bold ${size}px monospace`, cooling || a.disabled ? '#6a6f80' : '#e8ecf5', 'center');
  });
}

function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign): void {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#000';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawHpBar(ctx: CanvasRenderingContext2D, f: Fighter, trailHp: number): void {
  const left = f.side === 0;
  const x = left ? BAR_MARGIN : SCREEN_W - BAR_MARGIN - BAR_W;
  const frac = Math.max(0, f.hp / f.maxHp);
  const trailFrac = Math.max(frac, Math.min(1, trailHp / f.maxHp));

  // Frame
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 4, BAR_Y - 4, BAR_W + 8, BAR_H + 8);
  ctx.fillStyle = '#3a1416';
  ctx.fillRect(x, BAR_Y, BAR_W, BAR_H);

  // Bars drain towards the centre of the screen, like most fighting games.
  const fill = (fr: number, color: string) => {
    const w = BAR_W * fr;
    ctx.fillStyle = color;
    ctx.fillRect(left ? x + BAR_W - w : x, BAR_Y, w, BAR_H);
  };
  fill(trailFrac, '#f2f2f2'); // recent damage
  fill(frac, frac > 0.3 ? '#4cc36a' : '#e0b030');
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; // shine
  ctx.fillRect(x, BAR_Y, BAR_W, 6);

  // Name and HP number
  const label = `${f.name}  ${Math.ceil(f.hp)}`;
  outlinedText(ctx, label, left ? x + 10 : x + BAR_W - 10, BAR_Y + BAR_H / 2 + 1, 'bold 20px monospace', '#fff', left ? 'left' : 'right');
}
