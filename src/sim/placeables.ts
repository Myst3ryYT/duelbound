/**
 * Placeables: structures on the map. They block movement, can be shot down,
 * and can't be placed on top of players or each other.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Fighter, Placeable, World } from './types.ts';
import { dist, length } from './math.ts';
import { emitFx, emitSound } from './events.ts';
import { getPlaceableKind } from './classes/registry.ts';

/**
 * Can a structure of radius `r` go at (x, y)?
 * Uses the bigger "placement check" radius around players so a little lag
 * can't make a structure land inside someone.
 */
export function canPlaceAt(world: World, tuning: Tuning, x: number, y: number, r: number): boolean {
  const size = tuning.world.arenaSize;
  if (x - r < 0 || y - r < 0 || x + r > size || y + r > size) return false;
  for (const f of world.fighters) if (dist(x, y, f.x, f.y) < r + Math.max(f.radius, tuning.player.placementCheckRadius)) return false;
  for (const p of world.placeables) if (dist(x, y, p.x, p.y) < r + p.radius) return false;
  return true;
}

/** Can fighter `self` stand at (x, y)? (Not in a wall, a structure or another player.) */
export function canStandAt(world: World, tuning: Tuning, self: Fighter, x: number, y: number): boolean {
  const r = self.radius;
  const size = tuning.world.arenaSize;
  if (x - r < 0 || y - r < 0 || x + r > size || y + r > size) return false;
  for (const f of world.fighters) if (f !== self && dist(x, y, f.x, f.y) < r + f.radius) return false;
  for (const p of world.placeables) if (dist(x, y, p.x, p.y) < r + p.radius) return false;
  return true;
}

export function spawnPlaceable(world: World, props: Omit<Placeable, 'id' | 'age' | 'timer'>): Placeable {
  const p: Placeable = { id: world.nextId++, age: 0, timer: 0, ...props };
  world.placeables.push(p);
  return p;
}

export function damagePlaceable(world: World, p: Placeable, amount: number): void {
  p.hp -= amount;
  emitFx(world, 'burst', p.x, p.y, '#ffffff', 12, 0.15);
}

/** Run every structure's behaviour, then remove destroyed ones. */
export function updatePlaceables(world: World, tuning: Tuning, dt: number): void {
  for (const p of world.placeables) {
    p.age += dt;
    getPlaceableKind(p.kind)?.update(p, world, tuning, dt);
  }
  world.placeables = world.placeables.filter((p) => {
    if (p.hp > 0) return true;
    emitSound(world, 'structure_destroyed', p.x, p.y);
    emitFx(world, 'ring', p.x, p.y, '#c9cddb', p.radius * 1.8, 0.35);
    return false;
  });
}

/** Remove a structure quietly (it expired). */
export function removePlaceable(world: World, p: Placeable): void {
  world.placeables = world.placeables.filter((q) => q !== p);
}

/** Push fighters out of structures so they can't walk through them. */
export function collideFightersWithPlaceables(world: World): void {
  for (const f of world.fighters) {
    if (f.kind === 'dummy') continue;
    for (const p of world.placeables) {
      const dx = f.x - p.x;
      const dy = f.y - p.y;
      const d = length(dx, dy);
      const overlap = f.radius + p.radius - d;
      if (overlap <= 0) continue;
      const nx = d > 0.0001 ? dx / d : 1;
      const ny = d > 0.0001 ? dy / d : 0;
      f.x += nx * overlap;
      f.y += ny * overlap;
    }
  }
}
