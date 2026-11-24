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
  count?: number; // stored uses or ammo, shown in the corner
}

/** Extra things the game screen wants shown. */
export interface HudInfo {
  helpLines: string[]; // shown bottom-left, above the ability bar
  abilities: HudAbility[];
  roundTimeTotal: number; // full round clock (for the "FIGHT!" flash)
  roundsToWin: number; // number of round-win pips under each HP bar
}

const BAR_W = 780;
const BAR_H = 30;
const BAR_Y = 14;
const BAR_MARGIN = 60;

const ICON = 64;
const ICON_GAP = 12;
const ICONS_X = 26;
const ICONS_Y = SCREEN_H - ICON - 44;

export function drawHud(ctx: CanvasRenderingContext2D, world: World, info: HudInfo, trailHpOf: (id: number) => number): void {
  for (const f of world.fighters) drawHpBar(ctx, f, trailHpOf(f.id));
  drawAbilityBar(ctx, info.abilities);
  drawMatch(ctx, world, info);

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
  const big = (text: string, sub?: string, color = '#ffffff') => {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, SCREEN_H / 2 - 110, SCREEN_W, sub ? 200 : 160);
    outlinedText(ctx, text, SCREEN_W / 2, SCREEN_H / 2 - 30, 'bold 96px monospace', color, 'center');
    if (sub) outlinedText(ctx, sub, SCREEN_W / 2, SCREEN_H / 2 + 50, 'bold 32px monospace', '#c9cddb', 'center');
  };
  if (m.phase === 'countdown') big(String(Math.ceil(m.phaseT)), `ROUND ${m.round}`);
  else if (m.phase === 'fight' && info.roundTimeTotal - m.roundTime < 0.7) big('FIGHT!', undefined, '#ffd34d');
  else if (m.phase === 'roundOver' && m.matchWinner < 0) big(`${name(m.roundWinner).toUpperCase()} WINS`, `round ${m.round}`, '#ffd34d');
  else if (m.phase === 'tie') big('TIE!', `replaying round ${m.round}`, '#7fb0ff');
  else if (m.phase === 'roundOver' || m.phase === 'matchOver') big(`${name(m.matchWinner).toUpperCase()} WINS THE MATCH`, undefined, '#ffd34d');
}

function drawAbilityBar(ctx: CanvasRenderingContext2D, abilities: HudAbility[]): void {
  abilities.forEach((a, i) => {
    const x = ICONS_X + i * (ICON + ICON_GAP);
    const y = ICONS_Y;
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 3, y - 3, ICON + 6, ICON + 6);
    const sprite = findSprite(a.icon);
    if (sprite) ctx.drawImage(sprite.image, x, y, ICON, ICON);

    // Cooldown: a dark "clock hand" sweep plus the seconds left.
    if (a.cooldown > 0 && a.total > 0) {
      const frac = Math.min(1, a.cooldown / a.total);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, ICON, ICON);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(x + ICON / 2, y + ICON / 2);
      ctx.arc(x + ICON / 2, y + ICON / 2, ICON, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      outlinedText(ctx, a.cooldown >= 1 ? String(Math.ceil(a.cooldown)) : a.cooldown.toFixed(1), x + ICON / 2, y + ICON / 2, 'bold 24px monospace', '#fff', 'center');
    }
    if (a.count !== undefined) outlinedText(ctx, String(a.count), x + ICON - 6, y + 12, 'bold 18px monospace', '#ffe27a', 'right');
    if (a.active) {
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 4;
      ctx.strokeRect(x - 2, y - 2, ICON + 4, ICON + 4);
    }
    outlinedText(ctx, a.key, x + ICON / 2, y + ICON + 18, 'bold 16px monospace', '#c9cddb', 'center');
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
