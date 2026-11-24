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

/** What standing in slime does. */
export const slimeZone: ZoneKindDef = {
  kind: SLIME_ZONE,
  onFighter(world, tuning, z, f, dt) {
    const s = tuning.frog.slime;
    if (f.id === z.ownerId) {
      f.vars.speedMult = s.ownSpeedMult;
      return;
    }
    f.vars.speedMult = s.enemySlowMult;
    f.vars.acidT = (f.vars.acidT ?? 0) - dt;
    if (f.vars.acidT <= 0) {
      f.vars.acidT = s.acidTick;
      applyDamage(world, f, s.acidDps * s.acidTick, z.ownerId);
    }
  },
};
