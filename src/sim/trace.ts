/**
 * Traces a straight line through the arena, bouncing like a projectile would.
 * Used for:
 *  - the Sheriff's Piercing Bullet path preview (drawn while aiming)
 *  - the Refractor's Mind Ray beam (which deals damage along this path)
 */
import type { Tuning } from '../config/tuning.ts';
import type { World } from './types.ts';
import { segmentCircle } from './math.ts';
import { bounceNormal, closestPoint, pathHits } from './placeables.ts';
import { hitPoints, hitRadius } from './hitbox.ts';

export interface TraceOptions {
  ownerId: number; // never hits its owner, passes through the owner's non-mirror structures
  length: number; // total length including bounces
  radius: number; // thickness of the thing travelling (0 = a thin line)
  bounces: number; // bounces off walls and non-mirror structures
  wallsBounce: boolean; // false = stops at the arena edge
  maxMirrors: number; // mirror bounces allowed (they don't use up `bounces`)
}

export interface TraceResult {
  points: { x: number; y: number }[]; // start, every bounce, end
  mirrors: number; // how many mirrors it bounced off
  hitFighterId: number; // first fighter it reached (0 = none)
  hitPlaceableId: number; // structure it stopped on (0 = none)
}

export function tracePath(world: World, tuning: Tuning, x: number, y: number, angle: number, o: TraceOptions): TraceResult {
  const size = tuning.world.arenaSize;
  let dx = Math.cos(angle);
  let dy = Math.sin(angle);
  let left = o.length;
  let bounces = o.bounces;
  const res: TraceResult = { points: [{ x, y }], mirrors: 0, hitFighterId: 0, hitPlaceableId: 0 };
  let ignorePlaceable = 0; // the one we just bounced off

  for (let guard = 0; guard < 24 && left > 1; guard++) {
    const ex = x + dx * left;
    const ey = y + dy * left;
    // Find the closest thing along this straight piece.
    let bestT = 1;
    let hit: { type: 'wall' } | { type: 'fighter'; id: number } | { type: 'shield' } | { type: 'placeable'; id: number } | null = null;

    // Arena edge
    for (const [t] of [
      [dx < 0 ? (0 - x) / (ex - x) : dx > 0 ? (size - x) / (ex - x) : 2],
      [dy < 0 ? (0 - y) / (ey - y) : dy > 0 ? (size - y) / (ey - y) : 2],
    ])
      if (t >= 0 && t < bestT) {
        bestT = t;
        hit = { type: 'wall' };
      }

    for (const f of world.fighters) {
      if (f.id === o.ownerId) continue;
      if (f.shieldT > 0) {
        const t = segmentCircle(x, y, ex, ey, f.x, f.y, f.shieldRadius + o.radius);
        if (t >= 0 && t < bestT) {
          bestT = t;
          hit = { type: 'shield' };
        }
      }
      if (f.invulnT > 0) continue;
      for (const h of hitPoints(f)) {
        const t = segmentCircle(x, y, ex, ey, h.x, h.y, hitRadius(f, tuning) + o.radius);
        if (t >= 0 && t < bestT) {
          bestT = t;
          hit = { type: 'fighter', id: f.id };
        }
      }
    }

    for (const p of world.placeables) {
      if (p.id === ignorePlaceable) continue;
      if (p.ownerId === o.ownerId && !p.reflective) continue;
      const t = pathHits(p, x, y, ex, ey, o.radius);
      if (t >= 0 && t < bestT) {
        bestT = t;
        hit = { type: 'placeable', id: p.id };
      }
    }

    const hx = x + (ex - x) * bestT;
    const hy = y + (ey - y) * bestT;
    res.points.push({ x: hx, y: hy });
    left -= left * bestT;
    if (!hit) break;

    if (hit.type === 'fighter') {
      res.hitFighterId = hit.id;
      break;
    }
    if (hit.type === 'shield') break;

    if (hit.type === 'wall') {
      if (!o.wallsBounce || bounces <= 0) break;
      bounces--;
      if (hx <= 0.001 || hx >= size - 0.001) dx = -dx;
      if (hy <= 0.001 || hy >= size - 0.001) dy = -dy;
      x = Math.min(size, Math.max(0, hx));
      y = Math.min(size, Math.max(0, hy));
      ignorePlaceable = 0;
      continue;
    }

    // Structure
    const p = world.placeables.find((q) => q.id === hit.id)!;
    if (p.reflective) {
      if (res.mirrors >= o.maxMirrors) {
        res.hitPlaceableId = p.id;
        break;
      }
      res.mirrors++;
    } else {
      if (bounces <= 0) {
        res.hitPlaceableId = p.id;
        break;
      }
      bounces--;
    }
    const n = bounceNormal(p, x, y, hx, hy);
    const dot = dx * n.x + dy * n.y;
    dx -= 2 * dot * n.x;
    dy -= 2 * dot * n.y;
    const c = closestPoint(p, hx, hy);
    const push = p.radius + o.radius + 0.5;
    x = p.shape === 'segment' ? hx + n.x * 0.5 : c.x + n.x * push;
    y = p.shape === 'segment' ? hy + n.y * 0.5 : c.y + n.y * push;
    ignorePlaceable = p.id;
  }
  return res;
}
