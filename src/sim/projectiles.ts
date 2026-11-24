/**
 * Projectiles: spawning, flying, bouncing, turning around (Switch), reflecting
 * off mirrors and shields, and hitting fighters, structures and physics objects.
 *
 * Each tick a projectile moves in small steps (at most STEP units) and checks
 * the whole path of every step, so even very fast shots can't skip through things.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Projectile, World } from './types.ts';
import { clamp, lerp, segmentCircle } from './math.ts';
import { applyDamage } from './damage.ts';
import { bounceNormal, closestPoint, damagePlaceable, pathHits } from './placeables.ts';
import { hitPoints, hitRadius } from './hitbox.ts';
import { emitFx, emitSound } from './events.ts';
import { cancelSwitch, updateSwitch } from './switching.ts';
import { getObjectKind, getProjectileHook } from './classes/registry.ts';
import { damageObject } from './objects.ts';
import { applyHitstun } from './status.ts';

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
  reflectable?: boolean; // can a Mage shield reflect it [true]
  trail?: number; // seconds of visual trail [0]
  splits?: boolean; // doubles off its owner's mirrors, up to maxDoublings times [false]
  stunnedMultiplier?: number; // damage multiplier against a stunned target [1]
  /**
   * Where the shooter stands. If given, the short path from there to the spawn point is
   * checked first, so standing right against a mirror or structure can't shoot past it.
   */
  from?: { x: number; y: number };
  life?: number; // seconds before it vanishes [tuning.projectiles.maxLife]
  hitstun?: number; // hitstun frames put on a fighter it hits [0]
  slowRange?: number; // slows down steadily over this distance, then vanishes [0 = never slows]
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
    stunnedMultiplier: s.stunnedMultiplier ?? 1,
    falloffRange: s.falloffRange ?? 0,
    traveled: 0,
    bounces: s.bounces ?? 0,
    reflectable: s.reflectable ?? true,
    trail: s.trail ?? 0,
    splits: s.splits ?? false,
    doublings: 0,
    life: s.life ?? tuning.projectiles.maxLife,
    hitstun: s.hitstun ?? 0,
    slowRange: s.slowRange ?? 0,
    startSpeed: s.speed,
    switchT: 0,
    switchTotal: 0,
    switchVx: 0,
    switchVy: 0,
  };
  if (s.from) startAtFirstObstacle(world, tuning, p, s.from.x, s.from.y);
  world.projectiles.push(p);
  return p;
}

/**
 * If a structure sits between the shooter and where the shot appears, start the shot
 * just in front of that structure instead, so it bounces off / hits it normally.
 */
function startAtFirstObstacle(world: World, tuning: Tuning, p: Projectile, fromX: number, fromY: number): void {
  const hitR = p.radius * tuning.projectiles.hitboxScale;
  let best = -1;
  for (const pl of world.placeables) {
    if (pl.ownerId === p.ownerId && (!pl.reflective || pl.ownerPasses)) continue; // shots pass through your own structures
    const t = pathHits(pl, fromX, fromY, p.x, p.y, hitR);
    if (t >= 0 && (best < 0 || t < best)) best = t;
  }
  if (best < 0) return;
  p.x = fromX + (p.x - fromX) * best;
  p.y = fromY + (p.y - fromY) * best;
}

/** Damage after falloff (e.g. Sheriff's gun hits harder up close). */
function damageOf(p: Projectile): number {
  if (p.falloffRange <= 0) return p.damage;
  return lerp(p.damage, p.damageFar, clamp(p.traveled / p.falloffRange, 0, 1));
}

/**
 * Refractor shotgun: a pellet bouncing off its owner's mirror becomes two.
 * Each pellet can double up to maxDoublings times (a copy inherits its parent's
 * count), so mirrors facing each other can't multiply shots forever.
 */
function splitPellet(world: World, p: Projectile, tuning: Tuning, x: number, y: number): void {
  const half = ((tuning.refractor.shotgun.splitAngle * Math.PI) / 180) / 2;
  const speed = Math.hypot(p.vx, p.vy);
  const angle = Math.atan2(p.vy, p.vx);
  p.doublings++; // the copy below inherits this count
  p.vx = Math.cos(angle - half) * speed;
  p.vy = Math.sin(angle - half) * speed;
  const copy: Projectile = { ...p, id: world.nextId++, x, y, vx: Math.cos(angle + half) * speed, vy: Math.sin(angle + half) * speed };
  world.projectiles.push(copy);
  emitSound(world, 'mirror_split', x, y);
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
    // Slowing shots (Builder bricks): speed falls steadily to zero over slowRange, then they vanish.
    if (p.slowRange > 0 && p.switchT <= 0) {
      const speed = p.startSpeed * (1 - p.traveled / p.slowRange);
      if (speed < p.startSpeed * 0.08) continue;
      const cur = Math.hypot(p.vx, p.vy) || 1;
      p.vx *= speed / cur;
      p.vy *= speed / cur;
    }
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

      // ---- Structures ----
      //  mirrors:  always bounce the shot. Enemy shots also damage the mirror.
      //            Your own shotgun pellets double off your own mirror.
      //  shields:  (Mage) like a mirror, but the bounced shot becomes the Mage's,
      //            and the Mage's own shots pass through.
      //  others:   your own shots pass through; enemy shots damage it and
      //            bounce if they have bounces left, otherwise stop.
      // Find the structure this step touches FIRST (matters where pieces meet, like the
      // joints of the Mage's curved shield).
      let first: { pl: (typeof world.placeables)[number]; t: number; n: { x: number; y: number } } | null = null;
      for (const pl of world.placeables) {
        if (pl.ownerId === p.ownerId && (!pl.reflective || pl.ownerPasses)) continue;
        const t = pathHits(pl, ox, oy, nx, ny, hitR);
        if (t < 0 || (first && t >= first.t)) continue;
        const n = bounceNormal(pl, ox, oy, ox + (nx - ox) * t, oy + (ny - oy) * t);
        if (p.vx * n.x + p.vy * n.y >= 0) continue; // already moving away from it
        first = { pl, t, n };
      }
      if (first) {
        const { pl, t, n } = first;
        const own = pl.ownerId === p.ownerId;
        const hx = ox + (nx - ox) * t;
        const hy = oy + (ny - oy) * t;
        if (!own) damagePlaceable(world, pl, damageOf(p));
        if ((!pl.reflective && p.bounces <= 0) || (pl.claims && !p.reflectable)) {
          alive = false; // stopped (e.g. a lasso snaps on a shield)
          break;
        }
        reflect(p, n.x, n.y);
        cancelSwitch(p);
        if (pl.claims) p.ownerId = pl.ownerId; // the shield's owner takes over the shot
        if (!pl.reflective) p.bounces--;
        // push the shot back out to just outside the surface
        const c = closestPoint(pl, hx, hy);
        nx = c.x + n.x * (pl.radius + hitR + 1);
        ny = c.y + n.y * (pl.radius + hitR + 1);
        if (pl.reflective && own && p.splits && p.doublings < tuning.refractor.shotgun.maxDoublings) splitPellet(world, p, tuning, nx, ny);
        emitSound(world, pl.claims ? 'reflect' : pl.reflective ? 'mirror_bounce' : 'bounce', hx, hy);
        world.events.push({ type: 'bounce', projectileId: p.id, x: hx, y: hy });
      }
      if (!alive) break;

      // ---- Physics objects: knock them away (or, for solid ones like furniture, hit them) ----
      for (const o of world.objects) {
        if (p.behavior === 'lasso') continue; // the lasso flies straight through tumbleweeds
        const solid = getObjectKind(o.kind)?.solid;
        if (solid && o.ownerId === p.ownerId) continue; // your own shots pass your own furniture
        if (segmentCircle(ox, oy, nx, ny, o.x, o.y, o.radius + hitR) < 0) continue;
        if (solid) {
          damageObject(world, o, damageOf(p));
          alive = false;
          break;
        }
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
        const bodyR = hitRadius(f, tuning);
        if (!hitPoints(f).some((h) => segmentCircle(ox, oy, nx, ny, h.x, h.y, bodyR + hitR) >= 0)) continue;
        applyDamage(world, f, damageOf(p) * (f.stunT > 0 ? p.stunnedMultiplier : 1), p.ownerId);
        applyHitstun(f, p.hitstun, tuning.world.tickRate);
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
