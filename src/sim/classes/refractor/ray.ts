/**
 * REFRACTOR - RC - Mind Ray (instant, projectile)
 * Hold to fire a beam from the head. It uses a resource pool (the bar next to
 * the crosshair) that refills after a short rest. Damage comes in small fast
 * ticks, and doubles for every mirror the beam bounces off (up to 3).
 * The beam's path is worked out by sim/trace.ts.
 * Numbers: tuning.refractor.ray
 */
import type { Tuning } from '../../../config/tuning.ts';
import type { AbilityDef } from '../../abilities.ts';
import type { Fighter, World } from '../../types.ts';
import { tracePath, type TraceResult } from '../../trace.ts';
import { applyDamage } from '../../damage.ts';
import { damagePlaceable } from '../../placeables.ts';
import { emitSound } from '../../events.ts';

/** The beam's current path for this fighter (also used to draw it). */
export function traceRay(world: World, tuning: Tuning, f: Fighter, angle: number): TraceResult {
  const r = tuning.refractor.ray;
  return tracePath(world, tuning, f.x + Math.cos(angle) * f.radius, f.y + Math.sin(angle) * f.radius, angle, {
    ownerId: f.id,
    length: r.range,
    radius: 0,
    bounces: 0,
    wallsBounce: false,
    maxMirrors: r.maxReflections,
  });
}

export const ray: AbilityDef = {
  id: 'refractor_ray',
  name: 'Mind Ray',
  type: 'projectile',
  activation: 'instant',
  icon: 'icon_refractor_ray',
  cooldown: () => 0,

  update({ world, tuning, fighter: f, held, dt }) {
    const r = tuning.refractor.ray;
    if (f.vars.rayPool === undefined) f.vars.rayPool = r.pool;

    const firing = held && f.vars.rayPool > 0;
    if (firing && !f.vars.rayOn) emitSound(world, 'ray_start', f.x, f.y);
    f.vars.rayOn = firing ? 1 : 0;

    if (!firing) {
      f.vars.rayIdle = (f.vars.rayIdle ?? 0) + dt;
      f.vars.rayTick = 0;
      if (f.vars.rayIdle >= r.refillDelay) f.vars.rayPool = Math.min(r.pool, f.vars.rayPool + r.refill * dt);
      return;
    }

    f.vars.rayIdle = 0;
    f.vars.rayPool = Math.max(0, f.vars.rayPool - r.drain * dt);
    f.vars.rayTick = (f.vars.rayTick ?? 0) - dt;
    if (f.vars.rayTick > 0) return;
    f.vars.rayTick += r.tickInterval;

    // One damage tick along the beam.
    const beam = traceRay(world, tuning, f, f.aimAngle);
    const damage = r.dps * r.tickInterval * Math.pow(2, beam.mirrors);
    const target = world.fighters.find((x) => x.id === beam.hitFighterId);
    if (target) applyDamage(world, target, damage, f.id);
    const structure = world.placeables.find((p) => p.id === beam.hitPlaceableId);
    if (structure && structure.ownerId !== f.id) damagePlaceable(world, structure, damage);
  },
};
