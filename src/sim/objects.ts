/**
 * Physics objects (e.g. Sheriff's Bramble): they roll, slow down, bounce off
 * walls and structures, and get knocked around by projectiles (see projectiles.ts).
 * Only the simulation moves them, so online both players see the same thing.
 */
import type { Tuning } from '../config/tuning.ts';
import type { PhysObject, World } from './types.ts';
import { dist } from './math.ts';
import { updateSwitch } from './switching.ts';
import { getObjectKind } from './classes/registry.ts';
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
    updateSwitch(o, dt);
    if (o.switchT <= 0) {
      const drag = Math.exp(-(kind?.friction(tuning) ?? 0) * dt);
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

      // Structures
      for (const p of world.placeables) {
        const d = dist(o.x, o.y, p.x, p.y);
        const overlap = o.radius + p.radius - d;
        if (overlap <= 0) continue;
        const nx = d > 0.0001 ? (o.x - p.x) / d : 1;
        const ny = d > 0.0001 ? (o.y - p.y) / d : 0;
        o.x += nx * overlap;
        o.y += ny * overlap;
        const dot = o.vx * nx + o.vy * ny;
        if (dot < 0) {
          o.vx -= (1 + restitution) * dot * nx;
          o.vy -= (1 + restitution) * dot * ny;
        }
      }

      // Fighters: the object's own behaviour decides what touching does
      for (const f of world.fighters) {
        if (f.invulnT > 0 || dist(o.x, o.y, f.x, f.y) > o.radius + f.radius) continue;
        if (kind?.onTouch(world, tuning, o, f)) {
          alive = false;
          break;
        }
      }
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
}
