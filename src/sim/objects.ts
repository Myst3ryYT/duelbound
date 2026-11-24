/**
 * Physics objects (Sheriff's Bramble, Builder's furniture): they roll, slow down,
 * bounce off walls and structures, and react to projectiles (see projectiles.ts).
 * Solid ones also block players, and can be shot to pieces.
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
import { emitFx, emitSound } from './events.ts';

const STEP = 12; // world units per collision sub-step

type Defaults = 'id' | 'switchT' | 'switchTotal' | 'switchVx' | 'switchVy' | 'spin' | 'hp' | 'maxHp' | 'armed';

export function spawnObject(world: World, props: Omit<PhysObject, Defaults> & Partial<Pick<PhysObject, 'hp' | 'maxHp'>>): PhysObject {
  const o: PhysObject = { id: world.nextId++, switchT: 0, switchTotal: 0, switchVx: 0, switchVy: 0, spin: 0, hp: 0, maxHp: 0, armed: 0, ...props };
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
      const friction = (kind?.friction(tuning, o) ?? 0) + (carried.length ? (kind?.carryDrag?.(tuning) ?? 0) : 0);
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
        if (!hitPoints(f).some((h) => dist(o.x, o.y, h.x, h.y) <= o.radius + f.radius)) continue;
        if (f.invulnT <= 0 && kind?.onTouch(world, tuning, o, f)) {
          alive = false;
          break;
        }
        // Solid objects block players like a wall.
        if (kind?.solid && f.kind !== 'dummy') {
          const d = dist(o.x, o.y, f.x, f.y) || 0.001;
          const push = o.radius + f.radius - d;
          if (push > 0) {
            f.x += ((f.x - o.x) / d) * push;
            f.y += ((f.y - o.y) / d) * push;
          }
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
    if (o.maxHp > 0 && o.hp <= 0 && alive) {
      alive = false; // shot to pieces
      emitFx(world, 'burst', o.x, o.y, '#c8a060', o.radius * 2, 0.35);
      emitFx(world, 'ring', o.x, o.y, '#c8a060', o.radius * 1.6, 0.3);
      emitSound(world, 'structure_destroyed', o.x, o.y);
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

/** Damage a breakable object (does nothing to unbreakable ones). */
export function damageObject(world: World, o: PhysObject, amount: number): void {
  if (o.maxHp <= 0) return;
  o.hp -= amount;
  emitFx(world, 'burst', o.x, o.y, '#ffffff', 12, 0.15);
}
