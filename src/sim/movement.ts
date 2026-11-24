/**
 * Fighter movement: snappy walking, bumping into each other and the arena walls.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Fighter, PlayerInput } from './types.ts';
import { clamp, length } from './math.ts';

/**
 * Move one fighter for one tick.
 * - Direction changes are instant (no sliding).
 * - Speed ramps from 0 to full over `accelFrames` ticks.
 * - Letting go of the keys stops you on the spot.
 */
export function moveFighter(f: Fighter, input: PlayerInput, tuning: Tuning, dt: number): void {
  const len = length(input.moveX, input.moveY);
  if (len < 0.01) {
    f.vx = 0;
    f.vy = 0;
    return;
  }
  const dirX = input.moveX / len;
  const dirY = input.moveY / len;
  const topSpeed = tuning.player.moveSpeed * (f.vars.speedMult || 1); // zones (like Frog slime) can speed you up or slow you down
  const maxSpeed = topSpeed * Math.min(1, len); // len < 1 only with analog sticks
  const step = topSpeed / Math.max(1, tuning.player.accelFrames);
  const speed = Math.min(maxSpeed, length(f.vx, f.vy) + step);
  f.vx = dirX * speed;
  f.vy = dirY * speed;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
}

/** Point the fighter at where the player is aiming. */
export function updateAim(f: Fighter, input: PlayerInput): void {
  f.aimX = input.aimX;
  f.aimY = input.aimY;
  const dx = input.aimX - f.x;
  const dy = input.aimY - f.y;
  if (dx !== 0 || dy !== 0) f.aimAngle = Math.atan2(dy, dx);
}

/**
 * Stop fighters from overlapping. Players push each other apart equally;
 * the training dummy never moves, so only the player gets pushed.
 */
export function separateFighters(fighters: Fighter[]): void {
  for (let i = 0; i < fighters.length; i++) {
    for (let j = i + 1; j < fighters.length; j++) {
      const a = fighters[i];
      const b = fighters[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = length(dx, dy);
      const overlap = a.radius + b.radius - d;
      if (overlap <= 0) continue;
      // If they are exactly on top of each other, push sideways.
      const nx = d > 0.0001 ? dx / d : 1;
      const ny = d > 0.0001 ? dy / d : 0;
      const aFixed = a.kind === 'dummy';
      const bFixed = b.kind === 'dummy';
      if (aFixed && bFixed) continue;
      const aShare = aFixed ? 0 : bFixed ? 1 : 0.5;
      const bShare = 1 - aShare;
      a.x -= nx * overlap * aShare;
      a.y -= ny * overlap * aShare;
      b.x += nx * overlap * bShare;
      b.y += ny * overlap * bShare;
    }
  }
}

/** Keep a fighter fully inside the square arena. */
export function clampToArena(f: Fighter, arenaSize: number): void {
  f.x = clamp(f.x, f.radius, arenaSize - f.radius);
  f.y = clamp(f.y, f.radius, arenaSize - f.radius);
}
