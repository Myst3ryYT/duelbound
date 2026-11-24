/**
 * Guest-side movement prediction for online play.
 *
 * The guest moves its own character immediately (so controls feel instant)
 * using the same movement rules as the host, then corrects itself whenever a
 * host snapshot arrives by replaying the inputs the host hasn't applied yet.
 * Only walking is predicted; abilities and damage always come from the host.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Fighter, PlayerInput, World } from './types.ts';
import { clampToArena, moveFighter, updateAim } from './movement.ts';
import { distanceTo, surfaceNormal } from './placeables.ts';

/** Can this fighter's walking be predicted right now? (Not while stunned, rolling, teleporting...) */
export function canPredict(f: Fighter): boolean {
  return f.rootedT <= 0 && f.stunT <= 0 && !f.pullById && !(f.vars.rollT > 0) && !f.vars.tpActive && !f.vars.carriedBy;
}

/** Apply one tick of walking to the predicted fighter. */
export function predictStep(world: World, f: Fighter, input: PlayerInput, tuning: Tuning): void {
  updateAim(f, input);
  if (!canPredict(f)) return;
  if (world.match && world.match.phase !== 'fight') return; // frozen during countdown / results
  moveFighter(f, input, tuning, 1 / tuning.world.tickRate);
  // Walls of structures
  for (const p of world.placeables) {
    const overlap = f.radius + p.radius - distanceTo(p, f.x, f.y);
    if (overlap <= 0) continue;
    const n = surfaceNormal(p, f.x, f.y);
    f.x += n.x * overlap;
    f.y += n.y * overlap;
  }
  // The other player's body
  for (const o of world.fighters) {
    if (o.id === f.id) continue;
    const dx = f.x - o.x;
    const dy = f.y - o.y;
    const d = Math.hypot(dx, dy);
    const overlap = f.radius + o.radius - d;
    if (overlap > 0 && d > 0.0001) {
      f.x += (dx / d) * overlap * 0.5;
      f.y += (dy / d) * overlap * 0.5;
    }
  }
  clampToArena(f, tuning.world.arenaSize);
}
