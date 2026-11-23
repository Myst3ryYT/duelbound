/**
 * Projectiles: spawning, flying, turning around (Switch), reflecting off shields,
 * and hitting fighters and placeables.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Projectile, World } from './types.ts';
import { segmentCircle } from './math.ts';
import { applyDamage } from './damage.ts';
import { damagePlaceable } from './placeables.ts';
import { emitFx, emitSound } from './events.ts';

export interface ProjectileSpawn {
  ownerId: number;
  kind: string;
  x: number;
  y: number;
  angle: number; // direction in radians
  speed: number;
  radius: number;
  damage: number;
}

export function spawnProjectile(world: World, tuning: Tuning, s: ProjectileSpawn): Projectile {
  const p: Projectile = {
    id: world.nextId++,
    ownerId: s.ownerId,
    kind: s.kind,
    x: s.x,
    y: s.y,
    vx: Math.cos(s.angle) * s.speed,
    vy: Math.sin(s.angle) * s.speed,
    radius: s.radius,
    damage: s.damage,
    life: tuning.projectiles.maxLife,
    switchT: 0,
    switchTotal: 0,
    switchVx: 0,
    switchVy: 0,
  };
  world.projectiles.push(p);
  return p;
}

/** Start turning a projectile around (Mage's Switch). */
export function startSwitch(p: Projectile, turnTime: number): void {
  p.switchVx = p.vx;
  p.switchVy = p.vy;
  p.switchT = turnTime;
  p.switchTotal = turnTime;
}

export function updateProjectiles(world: World, tuning: Tuning, dt: number): void {
  const size = tuning.world.arenaSize;
  const survivors: Projectile[] = [];

  for (const p of world.projectiles) {
    // ---- Switch: slow down and curve into the opposite direction ----
    if (p.switchT > 0) {
      p.switchT = Math.max(0, p.switchT - dt);
      const k = 1 - p.switchT / p.switchTotal; // 0 -> 1 over the turn
      const turn = Math.PI * k;
      const slowest = tuning.mage.switch.slowest;
      const speedFactor = slowest + (1 - slowest) * Math.abs(Math.cos(turn));
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      p.vx = (p.switchVx * c - p.switchVy * s) * speedFactor;
      p.vy = (p.switchVx * s + p.switchVy * c) * speedFactor;
    }

    const ox = p.x;
    const oy = p.y;
    let nx = p.x + p.vx * dt;
    let ny = p.y + p.vy * dt;
    const hitR = p.radius * tuning.projectiles.hitboxScale;
    let alive = true;

    // ---- Reflective shields bounce enemy projectiles back, and take them over ----
    for (const f of world.fighters) {
      if (!alive || f.shieldT <= 0 || f.id === p.ownerId) continue;
      const t = segmentCircle(ox, oy, nx, ny, f.x, f.y, f.shieldRadius + hitR);
      if (t < 0) continue;
      const hx = ox + (nx - ox) * t;
      const hy = oy + (ny - oy) * t;
      let nX = hx - f.x;
      let nY = hy - f.y;
      const len = Math.hypot(nX, nY) || 1;
      nX /= len;
      nY /= len;
      const dot = p.vx * nX + p.vy * nY;
      if (dot < 0) {
        p.vx -= 2 * dot * nX;
        p.vy -= 2 * dot * nY;
      }
      p.switchT = 0;
      p.ownerId = f.id;
      nx = hx + nX * 2;
      ny = hy + nY * 2;
      emitSound(world, 'reflect', hx, hy);
      emitFx(world, 'burst', hx, hy, '#7fd0ff', 18, 0.25);
    }

    // ---- Placeables (projectiles pass through their owner's own structures) ----
    for (const pl of world.placeables) {
      if (!alive || pl.ownerId === p.ownerId) continue;
      if (segmentCircle(ox, oy, nx, ny, pl.x, pl.y, pl.radius + hitR) >= 0) {
        damagePlaceable(world, pl, p.damage);
        alive = false;
      }
    }

    // ---- Fighters ----
    for (const f of world.fighters) {
      if (!alive || f.id === p.ownerId) continue;
      const bodyR = f.kind === 'dummy' ? f.radius : tuning.player.projectileHitRadius;
      if (segmentCircle(ox, oy, nx, ny, f.x, f.y, bodyR + hitR) >= 0) {
        applyDamage(world, f, p.damage, p.ownerId);
        emitFx(world, 'burst', nx, ny, '#ffffff', 14, 0.2);
        alive = false;
      }
    }

    p.x = nx;
    p.y = ny;
    p.life -= dt;
    // ---- Arena walls and old age ----
    if (p.x < -p.radius || p.y < -p.radius || p.x > size + p.radius || p.y > size + p.radius) alive = false;
    if (p.life <= 0) alive = false;
    if (alive) survivors.push(p);
  }
  world.projectiles = survivors;
}
