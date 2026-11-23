/**
 * SHERIFF - LC - Gun (instant, projectile)
 * Fast revolver shots. Hold to keep firing. Hits harder the closer the target is.
 * Numbers: tuning.sheriff.gun
 */
import type { AbilityDef } from '../../abilities.ts';
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

  update({ world, tuning, fighter: f, slot, held }) {
    if (!held || !isReady(f, slot) || f.vars.rollT > 0) return;
    const g = tuning.sheriff.gun;
    spawnProjectile(world, tuning, {
      ownerId: f.id,
      kind: 'sheriff_bullet',
      x: f.x + Math.cos(f.aimAngle) * (f.radius + g.size + 4),
      y: f.y + Math.sin(f.aimAngle) * (f.radius + g.size + 4),
      angle: f.aimAngle,
      speed: g.speed,
      radius: g.size,
      damage: g.damageNear,
      damageFar: g.damageFar,
      falloffRange: g.falloffRange,
    });
    startCooldown(world, f, slot, g.fireInterval);
    emitSound(world, 'gun_fire', f.x, f.y);
  },
};
