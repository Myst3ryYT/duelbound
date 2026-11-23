/**
 * MAGE - LC - Staff (instant, projectile)
 * Hold to charge, release to fire. Longer charge = faster, bigger, more damage.
 * Numbers: tuning.mage.staff
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { spawnProjectile } from '../../projectiles.ts';
import { emitSound } from '../../events.ts';
import { lerp } from '../../math.ts';

export const staff: AbilityDef = {
  id: 'mage_staff',
  name: 'Staff',
  type: 'projectile',
  activation: 'instant',
  icon: 'icon_mage_staff',
  cooldown: (t) => t.mage.staff.fireInterval,

  update({ world, tuning, fighter: f, slot, held, dt }) {
    const s = tuning.mage.staff;
    // Start charging as soon as the button is down and the staff is ready.
    if (!f.vars.staffCharging && held && isReady(f, slot)) {
      f.vars.staffCharging = 1;
      f.vars.staffCharge = 0;
    }
    if (!f.vars.staffCharging) return;

    f.vars.staffCharge = Math.min(s.chargeTime, (f.vars.staffCharge ?? 0) + dt);
    if (held) return;

    // Released: fire.
    const k = s.chargeTime > 0 ? f.vars.staffCharge / s.chargeTime : 1; // 0 = tap, 1 = full charge
    const radius = lerp(s.sizeMin, s.sizeMax, k);
    spawnProjectile(world, tuning, {
      ownerId: f.id,
      kind: 'mage_bolt',
      x: f.x + Math.cos(f.aimAngle) * (f.radius + radius),
      y: f.y + Math.sin(f.aimAngle) * (f.radius + radius),
      angle: f.aimAngle,
      speed: lerp(s.speedMin, s.speedMax, k),
      radius,
      damage: lerp(s.damageMin, s.damageMax, k),
    });
    f.vars.staffCharging = 0;
    f.vars.staffCharge = 0;
    startCooldown(world, f, slot, s.fireInterval);
    emitSound(world, 'staff_fire', f.x, f.y);
  },
};
