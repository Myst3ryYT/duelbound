/**
 * Physics objects (e.g. Sheriff's Bramble): they roll, slow down, bounce off
 * walls and structures, and get knocked around by projectiles (see projectiles.ts).
 * Only the simulation moves them, so online both players see the same thing.
 *
 * An object can "carry" a fighter (fighter.vars.carriedBy = object id): the
 * fighter is dragged along with it while stunned, a bit slower than the object.
 */
import type { Tuning } from '../config/tuning.ts';
import type { PhysObject, World } from './types.ts';
import { dist } from './math.ts';
import { updateSwitch } from './switching.ts';
import { getObjectKind } from './classes/registry.ts';
import { closestPoint, distanceTo, surfaceNormal } from './placeables.ts';
import { hitPoints } from './hitbox.ts';
import { emitFx } from './events.ts';

const STEP = 12; // world units per collision sub-step

export function spawnObject(world: World, props: Omit<PhysObject, 'id' | 'switchT' | 'switchTotal' | 'switchVx' | 'switchVy' | 'spin'>): PhysObject {
  const o: PhysObject = { id: world.nextId++, switchT: 0, switchTotal: 0, switchVx: 0, switchVy: 0, spin: 0, ...props };
  world.objects.push(o);
  return o;
}

export function updateObjects(world: World, tuning: Tuning, dt: number): void {
  const size = tuning.world.arenaSize;
  const survivors: PhysObject[] = [];

  for (const o of world.objects) {
    const kind = getObjectKind(o.kind);
    const restitution = kind?.restitution(tuning) ?? 0.8;
    const carried = world.fighters.filter((f) => f.vars.carriedBy === o.id && f.stunT > 0);

    updateSwitch(o, dt);
    if (o.switchT <= 0) {
      const friction = (kind?.friction(tuning) ?? 0) + (carried.length ? (kind?.carryDrag?.(tuning) ?? 0) : 0);
      const drag = Math.exp(-friction * dt);
      o.vx *= drag;
      o.vy *= drag;
    }

    const speed = Math.hypot(o.vx, o.vy);
    const steps = Math.max(1, Math.ceil((speed * dt) / STEP));
    const sdt = dt / steps;
    let alive = true;

    for (let s = 0; s < steps && alive; s++) {
      o.x += o.vx * sdt;
      o.y += o.vy * sdt;

      // Arena walls
      if (o.x < o.radius) {
        o.x = o.radius;
        o.vx = Math.abs(o.vx) * restitution;
      } else if (o.x > size - o.radius) {
        o.x = size - o.radius;
        o.vx = -Math.abs(o.vx) * restitution;
      }
      if (o.y < o.radius) {
        o.y = o.radius;
        o.vy = Math.abs(o.vy) * restitution;
      } else if (o.y > size - o.radius) {
        o.y = size - o.radius;
        o.vy = -Math.abs(o.vy) * restitution;
      }

      // Structures (round ones and mirrors)
      for (const p of world.placeables) {
        const overlap = o.radius + p.radius - distanceTo(p, o.x, o.y);
        if (overlap <= 0) continue;
        const n = surfaceNormal(p, o.x, o.y);
        const c = closestPoint(p, o.x, o.y);
        o.x = c.x + n.x * (o.radius + p.radius);
        o.y = c.y + n.y * (o.radius + p.radius);
        const dot = o.vx * n.x + o.vy * n.y;
        if (dot < 0) {
          o.vx -= (1 + restitution) * dot * n.x;
          o.vy -= (1 + restitution) * dot * n.y;
        }
      }

      // Fighters: the object's own behaviour decides what touching does
      for (const f of world.fighters) {
        if (f.invulnT > 0) continue;
        if (!hitPoints(f).some((h) => dist(o.x, o.y, h.x, h.y) <= o.radius + f.radius)) continue;
        if (kind?.onTouch(world, tuning, o, f)) {
          alive = false;
          break;
        }
      }
    }

    // Drag carried (stunned) fighters along, a bit slower than the object.
    const carry = kind?.carry?.(tuning) ?? 0;
    for (const f of carried) {
      f.x += o.vx * carry * dt;
      f.y += o.vy * carry * dt;
    }

    o.spin += (Math.hypot(o.vx, o.vy) / Math.max(1, o.radius)) * dt;
    o.life -= dt;
    if (o.life <= 0 && alive) {
      alive = false;
      emitFx(world, 'burst', o.x, o.y, '#c8a060', o.radius * 1.5, 0.3);
    }
    if (alive) survivors.push(o);
  }
  world.objects = survivors;

  // Let go of anyone whose stun ended or whose object is gone.
  for (const f of world.fighters) {
    if (!f.vars.carriedBy) continue;
    if (f.stunT <= 0 || !world.objects.some((o) => o.id === f.vars.carriedBy)) f.vars.carriedBy = 0;
  }
}
