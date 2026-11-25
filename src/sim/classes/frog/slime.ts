/**
 * FROG - the slime pool (the Frog's mana) and his slime puddles.
 *
 * Slime pool: Belch, Acid Goop and goop-hops spend it. It refills by itself
 * after a short rest (refillDelay). Shown as the green bar by the crosshair.
 *
 * Slime puddles (ground zones): the Frog walks faster in his own slime; an enemy
 * in it is slowed and takes acid damage.
 * Numbers: tuning.frog.slime
 */
import type { Tuning } from '../../../config/tuning.ts';
import type { ZoneKindDef } from '../../abilities.ts';
import type { Fighter, World } from '../../types.ts';
import { applyDamage } from '../../damage.ts';
import { capZones, spawnZone } from '../../zones.ts';

export const SLIME_ZONE = 'frog_slime';

/** Current slime (sets it to full the first time). */
export function slimeOf(f: Fighter, t: Tuning): number {
  if (f.vars.slime === undefined) f.vars.slime = t.frog.slime.pool;
  return f.vars.slime;
}

/** Spend exactly `amount` if there's enough. Returns false (and spends nothing) if not. */
export function spendSlime(f: Fighter, t: Tuning, amount: number): boolean {
  if (slimeOf(f, t) < amount) return false;
  f.vars.slime -= amount;
  f.vars.slimeIdle = 0;
  return true;
}

/** Spend up to `amount` (whatever is left). Returns how much was spent. */
export function drainSlime(f: Fighter, t: Tuning, amount: number): number {
  const spent = Math.min(slimeOf(f, t), amount);
  f.vars.slime -= spent;
  f.vars.slimeIdle = 0;
  return spent;
}

/** Once per tick (ClassDef.tick): refill after a rest. */
export function tickSlime(f: Fighter, t: Tuning, dt: number): void {
  const s = t.frog.slime;
  slimeOf(f, t);
  f.vars.slimeIdle = (f.vars.slimeIdle ?? 0) + dt;
  if (f.vars.slimeIdle >= s.refillDelay) f.vars.slime = Math.min(s.pool, f.vars.slime + s.refill * dt);
}

/** Leave a slime puddle on the floor. */
export function dropSlime(world: World, t: Tuning, f: Fighter, radius: number, life: number): void {
  spawnZone(world, { ownerId: f.id, kind: SLIME_ZONE, x: f.x, y: f.y, radius, life });
  capZones(world, f.id, SLIME_ZONE, t.frog.goop.maxPuddles);
}

/** Is this fighter MARKED by the Frog `byId` (touched his slime recently)? */
export function isMarked(world: World, f: Fighter, byId: number): boolean {
  return (f.vars.markUntil ?? 0) > world.time && f.vars.markBy === byId;
}

/** Damage multiplier the Frog's tongue and belch get against this target (1 if not marked). */
export function markMult(world: World, tuning: Tuning, f: Fighter, byId: number): number {
  return isMarked(world, f, byId) ? tuning.frog.slime.markMult : 1;
}

/** Stick an enemy to the tongue: slowed for a moment (see slimeZone.always). */
export function stickTo(world: World, tuning: Tuning, f: Fighter): void {
  f.vars.stickUntil = world.time + tuning.frog.tongue.stickTime;
}

/**
 * What slime does to an enemy:
 * - touching it MARKS them for markTime seconds (the tongue and belch hit marked enemies harder);
 * - the longer they stand in it the bigger the "stack": more slow and more acid damage;
 * - the mark (slow and weaker acid) lingers after they walk out.
 * The Frog himself just walks faster in his own slime.
 */
export const slimeZone: ZoneKindDef = {
  kind: SLIME_ZONE,

  onFighter(world, tuning, z, f, dt) {
    const s = tuning.frog.slime;
    if (f.id === z.ownerId) {
      f.vars.speedMult = s.ownSpeedMult;
      return;
    }
    f.vars.markUntil = world.time + s.markTime;
    f.vars.markBy = z.ownerId;
    f.vars.slimeNow = 1; // (read by `always` just below, this same tick)
    f.vars.stack = Math.min(s.stackTime, (f.vars.stack ?? 0) + dt);
  },

  // Every tick for every fighter, in a puddle or not: slow + acid for anyone marked, stuck tongue slow.
  always(world, tuning, f, dt) {
    const s = tuning.frog.slime;
    const inSlime = f.vars.slimeNow === 1;
    f.vars.slimeNow = 0;

    if ((f.vars.stickUntil ?? 0) > world.time) f.vars.speedMult = Math.min(f.vars.speedMult, tuning.frog.tongue.stickMult);

    if (!isMarked(world, f, f.vars.markBy)) {
      f.vars.stack = 0; // the mark ran out: the stack is gone
      return;
    }
    const k = Math.min(1, (f.vars.stack ?? 0) / Math.max(0.001, s.stackTime)); // 0 -> 1
    const slow = inSlime ? s.enemySlowMult + (s.stackSlowMult - s.enemySlowMult) * k : s.stackSlowMult + (1 - s.stackSlowMult) * (1 - k);
    f.vars.speedMult = Math.min(f.vars.speedMult, slow);

    // Acid damage in ticks. Out of the slime only a lingering part of it.
    const dps = s.acidDps * (1 + (s.stackDpsMult - 1) * k) * (inSlime ? 1 : s.lingerDpsMult * k);
    f.vars.acidT = (f.vars.acidT ?? 0) - dt;
    if (f.vars.acidT <= 0) {
      f.vars.acidT = s.acidTick;
      if (dps > 0) applyDamage(world, f, dps * s.acidTick, f.vars.markBy);
    }
  },
};
