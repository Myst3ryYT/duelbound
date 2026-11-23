/**
 * The HUD: HP bars across the top, and the training help line at the bottom.
 * Everything here is in 1920x1080 screen units.
 */
import type { Fighter, World } from '../sim/types.ts';
import { SCREEN_H, SCREEN_W } from './view.ts';

/** Extra text the game screen wants shown. */
export interface HudInfo {
  helpLine: string; // shown under the arena
}

const BAR_W = 780;
const BAR_H = 30;
const BAR_Y = 14;
const BAR_MARGIN = 60;

export function drawHud(ctx: CanvasRenderingContext2D, world: World, info: HudInfo, trailHpOf: (id: number) => number): void {
  for (const f of world.fighters) drawHpBar(ctx, f, trailHpOf(f.id));

  ctx.font = '20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8a8fa3';
  ctx.fillText(info.helpLine, SCREEN_W / 2, SCREEN_H - 30);
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
  ctx.font = 'bold 20px monospace';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#fff';
  const label = `${f.name}  ${Math.ceil(f.hp)}`;
  ctx.textAlign = left ? 'left' : 'right';
  const tx = left ? x + 10 : x + BAR_W - 10;
  ctx.strokeText(label, tx, BAR_Y + BAR_H / 2 + 1);
  ctx.fillText(label, tx, BAR_Y + BAR_H / 2 + 1);
}
