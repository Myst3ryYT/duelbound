/**
 * SHERIFF - LC - Gun (instant, projectile)
 * Fast revolver shots, one per click (holding does nothing). The only limit on
 * how fast you can shoot is how fast you can click (a tiny delay between shots
 * stops auto-clickers). Six shots, then it reloads by itself.
 * Hits harder the closer the target is. Like the old Piercing Bullet it does extra
 * damage to a stunned target and gives a tiny hitstun.
 *
 * While riding the horse (V) it works differently: no ammo, and each click fires
 * a quick burst of bullets, then has to cool down.
 * Numbers: tuning.sheriff.gun (burst: tuning.sheriff.horse)
 */
import type { AbilityDef } from '../../abilities.ts';
import type { Tuning } from '../../../config/tuning.ts';
import type { Fighter, World } from '../../types.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { spawnProjectile } from '../../projectiles.ts';
import { emitSound } from '../../events.ts';

export const gun: AbilityDef = {
  id: 'sheriff_gun',
  name: 'Revolver',
  type: 'projectile',
  activation: 'instant',
  icon: 'icon_sheriff_gun',
  cooldown: (t) => t.sheriff.gun.fireInterval,

  update({ world, tuning, fighter: f, slot, pressed, stunned, dt }) {
    const g = tuning.sheriff.gun;
    const horse = tuning.sheriff.horse;
    if (f.vars.ammo === undefined) f.vars.ammo = g.ammo;

    // A horse burst in progress: one bullet every burstInterval until they're all out.
    if (f.vars.burstLeft > 0) {
      if (stunned) {
        f.vars.burstLeft = 0; // a stun interrupts the burst
        return;
      }
      f.vars.burstT -= dt;
      while (f.vars.burstLeft > 0 && f.vars.burstT <= 0) {
        fire(world, tuning, f, horse.burstDamageMult);
        f.vars.burstLeft -= 1;
        f.vars.burstT += horse.burstInterval;
      }
      return;
    }

    // Reload finished? (the reload uses this slot's cooldown, so the HUD shows it)
    if (f.vars.reloading && isReady(f, slot)) {
      f.vars.reloading = 0;
      f.vars.ammo = g.ammo;
      emitSound(world, 'reload_done', f.x, f.y);
    }

    if (!pressed || !isReady(f, slot) || f.vars.rollT > 0 || f.vars.reloading) return;

    // On the horse: a burst, no ammo used.
    if (f.vars.mountT > 0) {
      f.vars.burstLeft = horse.burstShots;
      f.vars.burstT = 0;
      startCooldown(world, f, slot, horse.burstShots * horse.burstInterval + horse.burstCooldown);
      return; // (the first bullet leaves on the next tick)
    }

    fire(world, tuning, f, 1);
    f.vars.ammo -= 1;
    if (f.vars.ammo <= 0) {
      f.vars.reloading = 1;
      startCooldown(world, f, slot, g.reloadTime);
      emitSound(world, 'reload_start', f.x, f.y);
    } else {
      startCooldown(world, f, slot, g.fireInterval);
    }
  },
};

/** One revolver bullet from the Sheriff's gun. `damageMult` scales its damage (horse bursts use less). */
function fire(world: World, tuning: Tuning, f: Fighter, damageMult: number): void {
  const g = tuning.sheriff.gun;
  spawnProjectile(world, tuning, {
    ownerId: f.id,
    kind: 'sheriff_bullet',
    x: f.x + Math.cos(f.aimAngle) * (f.radius + g.size + 4),
    y: f.y + Math.sin(f.aimAngle) * (f.radius + g.size + 4),
    angle: f.aimAngle,
    speed: g.speed,
    radius: g.size,
    damage: g.damageNear * damageMult,
    damageFar: g.damageFar * damageMult,
    falloffRange: g.falloffRange,
    stunnedMultiplier: g.stunnedMultiplier,
    hitstun: tuning.hitstun.gun,
    physics: g.physics,
    from: { x: f.x, y: f.y },
  });
  emitSound(world, 'gun_fire', f.x, f.y);
}
