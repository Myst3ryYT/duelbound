/**
 * MAGE - LC - Staff (instant, projectile)
 * Hold to keep firing a steady, middle-of-the-road magic bolt.
 * Fires faster while the Mage stands inside one of their Watchtowers' aura.
 * Numbers: tuning.mage.staff (fire-rate bonus: tuning.mage.watchtower)
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { spawnProjectile } from '../../projectiles.ts';
import { emitSound } from '../../events.ts';
import { inWatchtowerAura } from './watchtower.ts';

export const staff: AbilityDef = {
  id: 'mage_staff',
  name: 'Staff',
  type: 'projectile',
  activation: 'instant',
  icon: 'icon_mage_staff',
  cooldown: (t) => t.mage.staff.fireInterval,

  update({ world, tuning, fighter: f, slot, held }) {
    if (!held || !isReady(f, slot)) return;
    const s = tuning.mage.staff;
    spawnProjectile(world, tuning, {
      ownerId: f.id,
      kind: 'mage_bolt',
      physics: tuning.mage.staff.physics,
      x: f.x + Math.cos(f.aimAngle) * (f.radius + s.size),
      y: f.y + Math.sin(f.aimAngle) * (f.radius + s.size),
      angle: f.aimAngle,
      speed: s.speed,
      radius: s.size,
      damage: s.damage,
      from: { x: f.x, y: f.y },
    });
    const buffed = inWatchtowerAura(world, tuning, f);
    startCooldown(world, f, slot, buffed ? s.fireInterval / tuning.mage.watchtower.fireRateBonus : s.fireInterval);
    emitSound(world, 'staff_fire', f.x, f.y);
  },
};
