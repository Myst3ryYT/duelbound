/**
 * Projectiles: spawning, flying, bouncing, turning around (Switch), reflecting
 * off shields, and hitting fighters, structures and physics objects.
 *
 * Each tick a projectile moves in small steps (at most STEP units) and checks
 * the whole path of every step, so even very fast shots can't skip through things.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Projectile, World } from './types.ts';
import { clamp, lerp, segmentCircle } from './math.ts';
import { applyDamage } from './damage.ts';
import { damagePlaceable } from './placeables.ts';
import { emitFx, emitSound } from './events.ts';
import { cancelSwitch, updateSwitch } from './switching.ts';
import { getProjectileHook } from './classes/registry.ts';

const STEP = 24; // world units per collision sub-step

export interface ProjectileSpawn {
  ownerId: number;
  kind: string;
  x: number;
  y: number;
  angle: number; // direction in radians
  speed: number;
  radius: number;
  damage: number;
  // Optional extras (defaults in brackets):
  damageFar?: number; // damage at long range [same as damage]
  falloffRange?: number; // distance to reach damageFar [0 = no falloff]
  bounces?: number; // bounces off walls / structures [0]
  behavior?: string; // special on-hit behaviour ['']
  reflectable?: boolean; // can shields reflect it [true]
  trail?: number; // seconds of visual trail [0]
  life?: number; // seconds before it vanishes [tuning.projectiles.maxLife]
}

export function spawnProjectile(world: World, tuning: Tuning, s: ProjectileSpawn): Projectile {
  const p: Projectile = {
    id: world.nextId++,
    ownerId: s.ownerId,
    kind: s.kind,
    behavior: s.behavior ?? '',
    x: s.x,
    y: s.y,
    vx: Math.cos(s.angle) * s.speed,
    vy: Math.sin(s.angle) * s.speed,
    radius: s.radius,
    damage: s.damage,
    damageFar: s.damageFar ?? s.damage,
    falloffRange: s.falloffRange ?? 0,
    traveled: 0,
    bounces: s.bounces ?? 0,
    reflectable: s.reflectable ?? true,
    trail: s.trail ?? 0,
    life: s.life ?? tuning.projectiles.maxLife,
    switchT: 0,
    switchTotal: 0,
    switchVx: 0,
    switchVy: 0,
  };
  world.projectiles.push(p);
  return p;
}

/** Damage after falloff (e.g. Sheriff's gun hits harder up close). */
function damageOf(p: Projectile): number {
  if (p.falloffRange <= 0) return p.damage;
  return lerp(p.damage, p.damageFar, clamp(p.traveled / p.falloffRange, 0, 1));
}

/** Bounce a velocity off a surface with normal (nx, ny). */
function reflect(p: Projectile, nx: number, ny: number): void {
  const dot = p.vx * nx + p.vy * ny;
  if (dot < 0) {
    p.vx -= 2 * dot * nx;
    p.vy -= 2 * dot * ny;
  }
}

export function updateProjectiles(world: World, tuning: Tuning, dt: number): void {
  const size = tuning.world.arenaSize;
  const survivors: Projectile[] = [];

  for (const p of world.projectiles) {
    updateSwitch(p, dt);
    const hitR = p.radius * tuning.projectiles.hitboxScale;
    const travel = Math.hypot(p.vx, p.vy) * dt;
    const steps = Math.max(1, Math.ceil(travel / STEP));
    const sdt = dt / steps;
    let alive = true;

    for (let s = 0; s < steps && alive; s++) {
      const ox = p.x;
      const oy = p.y;
      let nx = p.x + p.vx * sdt;
      let ny = p.y + p.vy * sdt;

      // ---- Reflective shields ----
      for (const f of world.fighters) {
        if (!alive || f.shieldT <= 0 || f.id === p.ownerId) continue;
        const t = segmentCircle(ox, oy, nx, ny, f.x, f.y, f.shieldRadius + hitR);
        if (t < 0) continue;
        const hx = ox + (nx - ox) * t;
        const hy = oy + (ny - oy) * t;
        if (!p.reflectable) {
          alive = false; // e.g. a lasso just snaps on the shield
          emitFx(world, 'burst', hx, hy, '#7fd0ff', 14, 0.2);
          break;
        }
        const len = Math.hypot(hx - f.x, hy - f.y) || 1;
        const nX = (hx - f.x) / len;
        const nY = (hy - f.y) / len;
        reflect(p, nX, nY);
        cancelSwitch(p);
        p.ownerId = f.id; // the shield's owner takes over the projectile
        nx = hx + nX * 2;
        ny = hy + nY * 2;
        emitSound(world, 'reflect', hx, hy);
        emitFx(world, 'burst', hx, hy, '#7fd0ff', 18, 0.25);
      }
      if (!alive) break;

      // ---- Structures: damage them; bounce if it can, otherwise stop ----
      for (const pl of world.placeables) {
        if (pl.ownerId === p.ownerId) continue; // passes through its owner's own structures
        const t = segmentCircle(ox, oy, nx, ny, pl.x, pl.y, pl.radius + hitR);
        if (t < 0) continue;
        damagePlaceable(world, pl, damageOf(p));
        if (p.bounces <= 0) {
          alive = false;
          break;
        }
        const hx = ox + (nx - ox) * t;
        const hy = oy + (ny - oy) * t;
        const len = Math.hypot(hx - pl.x, hy - pl.y) || 1;
        reflect(p, (hx - pl.x) / len, (hy - pl.y) / len);
        p.bounces--;
        nx = hx + ((hx - pl.x) / len) * 2;
        ny = hy + ((hy - pl.y) / len) * 2;
        emitSound(world, 'bounce', hx, hy);
        world.events.push({ type: 'bounce', projectileId: p.id, x: hx, y: hy });
        break;
      }
      if (!alive) break;

      // ---- Physics objects: knock them away ----
      for (const o of world.objects) {
        if (segmentCircle(ox, oy, nx, ny, o.x, o.y, o.radius + hitR) < 0) continue;
        const sp = Math.hypot(p.vx, p.vy) || 1;
        o.vx += (p.vx / sp) * tuning.sheriff.bramble.shotImpulse;
        o.vy += (p.vy / sp) * tuning.sheriff.bramble.shotImpulse;
        cancelSwitch(o);
        emitFx(world, 'burst', nx, ny, '#c8a060', 12, 0.2);
        alive = false;
        break;
      }
      if (!alive) break;

      // ---- Fighters ----
      for (const f of world.fighters) {
        if (f.id === p.ownerId || f.invulnT > 0) continue;
        const bodyR = f.kind === 'dummy' ? f.radius : tuning.player.projectileHitRadius;
        if (segmentCircle(ox, oy, nx, ny, f.x, f.y, bodyR + hitR) < 0) continue;
        applyDamage(world, f, damageOf(p), p.ownerId);
        getProjectileHook(p.behavior)?.(world, tuning, p, f);
        emitFx(world, 'burst', nx, ny, '#ffffff', 14, 0.2);
        alive = false;
        break;
      }
      if (!alive) break;

      // ---- Arena walls: bounce or vanish ----
      if (nx < 0 || nx > size || ny < 0 || ny > size) {
        if (p.bounces > 0) {
          // Where exactly it touched the wall (for the trail's corner).
          const wallX = nx < 0 ? 0 : nx > size ? size : nx;
          const wallY = ny < 0 ? 0 : ny > size ? size : ny;
          const tx = nx !== wallX ? (wallX - ox) / (nx - ox) : 1;
          const ty = ny !== wallY ? (wallY - oy) / (ny - oy) : 1;
          const tHit = Math.min(tx, ty);
          const cornerX = ox + (nx - ox) * tHit;
          const cornerY = oy + (ny - oy) * tHit;
          if (nx < 0 || nx > size) {
            p.vx = -p.vx;
            nx = nx < 0 ? -nx : 2 * size - nx;
          }
          if (ny < 0 || ny > size) {
            p.vy = -p.vy;
            ny = ny < 0 ? -ny : 2 * size - ny;
          }
          p.bounces--;
          emitSound(world, 'bounce', nx, ny);
          world.events.push({ type: 'bounce', projectileId: p.id, x: cornerX, y: cornerY });
        } else {
          alive = false;
        }
      }

      p.traveled += Math.hypot(nx - ox, ny - oy);
      p.x = nx;
      p.y = ny;
    }

    p.life -= dt;
    if (p.life <= 0) alive = false;
    if (alive) survivors.push(p);
  }
  world.projectiles = survivors;
}
