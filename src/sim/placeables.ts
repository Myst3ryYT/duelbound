/**
 * Placeables: structures on the map. They block movement, can be shot down,
 * and can't be placed on top of players or each other.
 *
 * Two shapes:
 *  - circle  (watchtower): centre + radius
 *  - segment (mirror):     a line from (x1, y1) to (x2, y2), `radius` = half its thickness
 */
import type { Tuning } from '../config/tuning.ts';
import type { Fighter, Placeable, World } from './types.ts';
import { closestOnSegment, dist, distToSegment, segmentCapsule, segmentCircle, segmentSegmentDistance } from './math.ts';
import { emitFx, emitSound } from './events.ts';
import { getPlaceableKind } from './classes/registry.ts';

// ------------------------------------------------------------- geometry ----

/** Distance from a point to a structure's centre line (0 inside a segment's line). */
export function distanceTo(p: Placeable, x: number, y: number): number {
  return p.shape === 'segment' ? distToSegment(x, y, p.x1, p.y1, p.x2, p.y2) : dist(x, y, p.x, p.y);
}

/** The point of the structure's centre line closest to (x, y). */
export function closestPoint(p: Placeable, x: number, y: number): { x: number; y: number } {
  return p.shape === 'segment' ? closestOnSegment(x, y, p.x1, p.y1, p.x2, p.y2) : { x: p.x, y: p.y };
}

/** Does a point moving A -> B come within `extra` of the structure's surface? 0..1 along the path, or -1. */
export function pathHits(p: Placeable, ax: number, ay: number, bx: number, by: number, extra: number): number {
  return p.shape === 'segment'
    ? segmentCapsule(ax, ay, bx, by, p.x1, p.y1, p.x2, p.y2, p.radius + extra)
    : segmentCircle(ax, ay, bx, by, p.x, p.y, p.radius + extra);
}

/** Unit vector pointing from the structure's surface out towards (x, y). */
export function surfaceNormal(p: Placeable, x: number, y: number): { x: number; y: number } {
  const c = closestPoint(p, x, y);
  let nx = x - c.x;
  let ny = y - c.y;
  let len = Math.hypot(nx, ny);
  if (len < 0.0001 && p.shape === 'segment') {
    // Exactly on the line: use the line's perpendicular.
    nx = -(p.y2 - p.y1);
    ny = p.x2 - p.x1;
    len = Math.hypot(nx, ny);
  }
  return len > 0.0001 ? { x: nx / len, y: ny / len } : { x: 1, y: 0 };
}

/**
 * The direction something bounces away from when it hits this structure.
 * Mirrors (segments) always bounce off their flat face, even near the tips,
 * on the side the shot came from. Round structures bounce away from their centre.
 * @param fromX/fromY  where the shot was coming from (before the hit)
 * @param hitX/hitY    where it touched
 */
export function bounceNormal(p: Placeable, fromX: number, fromY: number, hitX: number, hitY: number): { x: number; y: number } {
  if (p.shape !== 'segment') return surfaceNormal(p, hitX, hitY);
  const len = Math.hypot(p.x2 - p.x1, p.y2 - p.y1) || 1;
  let nx = -(p.y2 - p.y1) / len;
  let ny = (p.x2 - p.x1) / len;
  // Point the normal towards the side the shot came from.
  if ((fromX - p.x1) * nx + (fromY - p.y1) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: nx, y: ny };
}

// ------------------------------------------------------------ placement ----

/**
 * Can a round structure of radius `r` go at (x, y)?
 * Uses the bigger "placement check" radius around players so a little lag
 * can't make a structure land inside someone.
 */
export function canPlaceAt(world: World, tuning: Tuning, x: number, y: number, r: number): boolean {
  const size = tuning.world.arenaSize;
  if (x - r < 0 || y - r < 0 || x + r > size || y + r > size) return false;
  for (const f of world.fighters) if (dist(x, y, f.x, f.y) < r + Math.max(f.radius, tuning.player.placementCheckRadius)) return false;
  for (const p of world.placeables) if (distanceTo(p, x, y) < r + p.radius) return false;
  return true;
}

/** Can a line structure (thickness 2r) go from (x1, y1) to (x2, y2)? */
export function canPlaceSegment(world: World, tuning: Tuning, x1: number, y1: number, x2: number, y2: number, r: number): boolean {
  const size = tuning.world.arenaSize;
  for (const [x, y] of [
    [x1, y1],
    [x2, y2],
  ])
    if (x < 0 || y < 0 || x > size || y > size) return false;
  for (const f of world.fighters) if (distToSegment(f.x, f.y, x1, y1, x2, y2) < r + Math.max(f.radius, tuning.player.placementCheckRadius)) return false;
  for (const p of world.placeables) {
    const d = p.shape === 'segment' ? segmentSegmentDistance(x1, y1, x2, y2, p.x1, p.y1, p.x2, p.y2) : distToSegment(p.x, p.y, x1, y1, x2, y2);
    if (d < r + p.radius) return false;
  }
  return true;
}

/** Can fighter `self` stand at (x, y)? (Not in a wall, a structure or another player.) */
export function canStandAt(world: World, tuning: Tuning, self: Fighter, x: number, y: number): boolean {
  const r = self.radius;
  const size = tuning.world.arenaSize;
  if (x - r < 0 || y - r < 0 || x + r > size || y + r > size) return false;
  for (const f of world.fighters) if (f !== self && dist(x, y, f.x, f.y) < r + f.radius) return false;
  for (const p of world.placeables) if (distanceTo(p, x, y) < r + p.radius) return false;
  return true;
}

// --------------------------------------------------------- create/update ----

type NewPlaceable = Omit<Placeable, 'id' | 'age' | 'timer' | 'shape' | 'x1' | 'y1' | 'x2' | 'y2' | 'reflective' | 'breakT'> &
  Partial<Pick<Placeable, 'shape' | 'x1' | 'y1' | 'x2' | 'y2' | 'reflective' | 'breakT'>>;

export function spawnPlaceable(world: World, props: NewPlaceable): Placeable {
  const p: Placeable = { id: world.nextId++, age: 0, timer: 0, shape: 'circle', x1: 0, y1: 0, x2: 0, y2: 0, reflective: false, breakT: -1, ...props };
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
    if (p.breakT >= 0) {
      p.breakT -= dt;
      if (p.breakT <= 0) p.hp = 0;
    }
    getPlaceableKind(p.kind)?.update(p, world, tuning, dt);
  }
  world.placeables = world.placeables.filter((p) => {
    if (p.hp > 0) return true;
    emitSound(world, p.reflective ? 'mirror_break' : 'structure_destroyed', p.x, p.y);
    emitFx(world, 'ring', p.x, p.y, p.reflective ? '#bfe8ff' : '#c9cddb', 50, 0.35);
    emitFx(world, 'burst', p.x, p.y, p.reflective ? '#bfe8ff' : '#c9cddb', 40, 0.35);
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
      const overlap = f.radius + p.radius - distanceTo(p, f.x, f.y);
      if (overlap <= 0) continue;
      const n = surfaceNormal(p, f.x, f.y);
      f.x += n.x * overlap;
      f.y += n.y * overlap;
    }
  }
}
