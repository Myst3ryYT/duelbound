/**
 * SHERIFF - V - Horse (instant, misc)
 * A horse appears under the Sheriff, who rides it for a few seconds:
 *  - faster walking, and a bigger body (a bigger target, but also harder to push around)
 *  - the horse has its own health: hits take it off the horse first, the Sheriff only
 *    feels what's left over. When it's gone (or time is up) the Sheriff hops off.
 *  - running into the enemy tramples them (damage + a shove)
 * Numbers: tuning.sheriff.horse
 *
 * The shared fighter variables it uses (other classes can use them too):
 *   vars.speedMult  - walking speed multiplier (see movement.ts)
 *   vars.absorbHp   - a pool of health that takes damage first (see damage.ts)
 */
import type { AbilityDef, ClassDef } from '../../abilities.ts';
import type { Fighter, World } from '../../types.ts';
import type { Tuning } from '../../../config/tuning.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { applyDamage } from '../../damage.ts';
import { applyHitstun, applyKnockback } from '../../status.ts';
import { emitFx, emitSound } from '../../events.ts';
import { dist } from '../../math.ts';

export const horse: AbilityDef = {
  id: 'sheriff_horse',
  name: 'Horse',
  type: 'misc',
  activation: 'instant',
  icon: 'icon_sheriff_horse',
  cooldown: (t) => t.sheriff.horse.cooldown,

  update({ world, tuning, fighter: f, slot, pressed, stunned, dt }) {
    const h = tuning.sheriff.horse;

    if (f.vars.mountT > 0) {
      f.vars.mountT -= dt;
      f.vars.trampleCd = Math.max(0, (f.vars.trampleCd ?? 0) - dt);
      if (f.vars.mountT <= 0 || f.vars.absorbHp <= 0) dismount(world, tuning, f);
      else trample(world, tuning, f);
      return;
    }

    if (!pressed || !isReady(f, slot) || stunned || f.pullById) return;
    f.vars.mountT = h.duration;
    f.vars.absorbHp = h.hp;
    f.vars.speedMult = h.speedMult;
    f.radius = h.size;
    startCooldown(world, f, slot, h.cooldown);
    emitFx(world, 'burst', f.x, f.y, '#c8a060', 80, 0.3);
    emitSound(world, 'horse_call', f.x, f.y);
  },
};

/** Hop off: normal speed and size again, and the horse's leftover health is gone. */
function dismount(world: World, tuning: Tuning, f: Fighter): void {
  f.vars.mountT = 0;
  f.vars.absorbHp = 0;
  f.vars.speedMult = 1;
  f.radius = tuning.player.bodyRadius;
  emitFx(world, 'burst', f.x, f.y, '#c8a060', 60, 0.25);
  emitSound(world, 'horse_leave', f.x, f.y);
}

/** Running into the enemy while riding hurts them and shoves them away. */
function trample(world: World, tuning: Tuning, f: Fighter): void {
  const h = tuning.sheriff.horse;
  if (f.vars.trampleCd > 0) return;
  for (const target of world.fighters) {
    if (target.id === f.id || target.invulnT > 0) continue;
    if (dist(f.x, f.y, target.x, target.y) > f.radius + target.radius + 4) continue;
    applyDamage(world, target, h.trampleDamage, f.id);
    applyHitstun(target, tuning.hitstun.trample, tuning.world.tickRate);
    applyKnockback(target, Math.atan2(target.y - f.y, target.x - f.x), h.trampleKnockback);
    f.vars.trampleCd = h.trampleDelay;
    emitSound(world, 'hammer_hit', target.x, target.y);
  }
}

/** Crosshair bar: how much of the ride is left. */
export const horseBar: NonNullable<ClassDef['crosshairBar']> = (f, t) => {
  if (!(f.vars.mountT > 0)) return null;
  return { fill: f.vars.mountT / t.sheriff.horse.duration, color: '#c8a060' };
};
