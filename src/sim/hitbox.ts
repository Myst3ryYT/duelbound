/**
 * Where a fighter can be hit: one circle at the body.
 * (Kept as its own function so a class could later have an unusual hitbox.)
 */
import type { Tuning } from '../config/tuning.ts';
import type { Fighter } from './types.ts';

export function hitPoints(f: Fighter): { x: number; y: number }[] {
  return [{ x: f.x, y: f.y }];
}

/** Radius of each hit circle for projectiles. */
export function hitRadius(f: Fighter, tuning: Tuning): number {
  // Players are hit a little bigger than their body; a bigger body (the horse) is a bigger target.
  return f.kind === 'dummy' ? f.radius : f.radius + tuning.player.projectileHitRadius - tuning.player.bodyRadius;
}
