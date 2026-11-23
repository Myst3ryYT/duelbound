/**
 * Where a fighter can be hit. Normally one circle at the body; while the
 * Refractor is split (Refract), two circles, one per half. Hitting either half
 * hurts the player.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Fighter } from './types.ts';

export function hitPoints(f: Fighter): { x: number; y: number }[] {
  if (f.vars.refractT > 0) {
    const half = f.vars.refractSep / 2;
    const px = Math.cos(f.vars.refractAngle) * half;
    const py = Math.sin(f.vars.refractAngle) * half;
    return [
      { x: f.x + px, y: f.y + py },
      { x: f.x - px, y: f.y - py },
    ];
  }
  return [{ x: f.x, y: f.y }];
}

/** Radius of each hit circle for projectiles. */
export function hitRadius(f: Fighter, tuning: Tuning): number {
  return f.kind === 'dummy' ? f.radius : tuning.player.projectileHitRadius;
}
