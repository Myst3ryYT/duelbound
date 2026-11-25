/**
 * Ground zones: flat patches on the floor that don't block anything, they just
 * do something to fighters standing in them (the Frog's slime puddles, for example).
 * Each class registers how its zone kinds behave (ClassDef.zones).
 *
 * Every tick, before anyone moves, each fighter's speed multiplier is reset to 1
 * and every zone they stand in gets a say. Airborne fighters (hopping, vars.airT > 0)
 * float over zones.
 */
import type { Tuning } from '../config/tuning.ts';
import type { World, Zone } from './types.ts';
import { dist } from './math.ts';
import { allZoneKinds, getZoneKind } from './classes/registry.ts';

export function spawnZone(world: World, props: Omit<Zone, 'id' | 'maxLife'>): Zone {
  const z: Zone = { id: world.nextId++, maxLife: props.life, ...props };
  world.zones.push(z);
  return z;
}

/** Remove the oldest zones of this owner and kind so there are at most `max`. */
export function capZones(world: World, ownerId: number, kind: string, max: number): void {
  const mine = world.zones.filter((z) => z.ownerId === ownerId && z.kind === kind);
  const extra = mine.length - max;
  if (extra <= 0) return;
  const drop = new Set(mine.slice(0, extra).map((z) => z.id)); // oldest first
  world.zones = world.zones.filter((z) => !drop.has(z.id));
}

export function updateZones(world: World, tuning: Tuning, dt: number): void {
  for (const z of world.zones) z.life -= dt;
  world.zones = world.zones.filter((z) => z.life > 0);

  for (const f of world.fighters) {
    f.vars.speedMult = 1;
    if (f.vars.airT > 0) continue; // hopping over it
    // Each kind of zone counts once per fighter, however many of its puddles overlap.
    const done = new Set<string>();
    for (const z of world.zones) {
      const key = z.kind + ':' + z.ownerId;
      if (done.has(key) || dist(f.x, f.y, z.x, z.y) > z.radius) continue;
      done.add(key);
      getZoneKind(z.kind)?.onFighter(world, tuning, z, f, dt);
    }
    for (const k of allZoneKinds()) k.always?.(world, tuning, f, dt);
  }
}
