/**
 * SHERIFF - V - Horse (instant, misc)
 * A horse appears under the Sheriff and charges off in the direction he was
 * facing. You can't steer it; it runs for a few seconds and:
 *  - bounces off the arena walls
 *  - smashes through structures (walls, mirrors...), losing a bit of its health each time
 *  - tramples the enemy if it runs into them (damage + a shove)
 *  - has its own health: hits take it off the horse first, the Sheriff only feels
 *    what's left over. When it's gone (or time is up) the Sheriff hops off.
 * While riding, the Sheriff can still aim, and the revolver fires bursts (see gun.ts).
 * Numbers: tuning.sheriff.horse
 *
 * The shared fighter variable it uses (other classes can use it too):
 *   vars.absorbHp - a pool of health that takes damage first (see damage.ts)
 */
import type { AbilityDef, ClassDef } from '../../abilities.ts';
import type { Fighter, World } from '../../types.ts';
import type { Tuning } from '../../../config/tuning.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { applyDamage } from '../../damage.ts';
import { distanceTo, removePlaceable } from '../../placeables.ts';
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
      f.rootedT = Math.max(f.rootedT, dt * 2); // you can't walk: the horse decides where you go
      if (f.vars.mountT <= 0 || f.vars.absorbHp <= 0) {
        dismount(world, tuning, f);
        return;
      }
      if (f.hitstunT <= 0) gallop(world, tuning, f, dt);
      trample(world, tuning, f);
      return;
    }

    if (!pressed || !isReady(f, slot) || stunned || f.pullById) return;
    f.vars.mountT = h.duration;
    f.vars.absorbHp = h.hp;
    f.vars.mountDX = Math.cos(f.aimAngle); // locked in: the way you were facing
    f.vars.mountDY = Math.sin(f.aimAngle);
    f.radius = h.size;
    startCooldown(world, f, slot, h.cooldown);
    emitFx(world, 'burst', f.x, f.y, '#c8a060', 80, 0.3);
    emitSound(world, 'horse_call', f.x, f.y);
  },
};

/** Run in the locked direction: bounce off arena walls, smash structures. */
function gallop(world: World, tuning: Tuning, f: Fighter, dt: number): void {
  const h = tuning.sheriff.horse;
  const size = tuning.world.arenaSize;
  f.x += f.vars.mountDX * h.speed * dt;
  f.y += f.vars.mountDY * h.speed * dt;
  f.vx = f.vars.mountDX * h.speed; // (so the walking animation plays)
  f.vy = f.vars.mountDY * h.speed;

  if (f.x < f.radius) {
    f.x = f.radius;
    f.vars.mountDX = Math.abs(f.vars.mountDX);
  } else if (f.x > size - f.radius) {
    f.x = size - f.radius;
    f.vars.mountDX = -Math.abs(f.vars.mountDX);
  }
  if (f.y < f.radius) {
    f.y = f.radius;
    f.vars.mountDY = Math.abs(f.vars.mountDY);
  } else if (f.y > size - f.radius) {
    f.y = size - f.radius;
    f.vars.mountDY = -Math.abs(f.vars.mountDY);
  }

  // Structures in the way are smashed (each one costs the horse some health).
  for (const p of [...world.placeables]) {
    if (distanceTo(p, f.x, f.y) > f.radius + p.radius) continue;
    removePlaceable(world, p);
    f.vars.absorbHp -= h.structureCost;
    emitFx(world, 'burst', p.x, p.y, '#c8a060', 60, 0.3);
    emitSound(world, 'structure_destroyed', p.x, p.y);
  }
}

/** Hop off: normal size again, and the horse's leftover health is gone. */
function dismount(world: World, tuning: Tuning, f: Fighter): void {
  f.vars.mountT = 0;
  f.vars.absorbHp = 0;
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
