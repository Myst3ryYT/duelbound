/**
 * SHERIFF - LC - Gun (instant, projectile)
 * Fast revolver shots, one per click (holding does nothing). There's no ammo and no reload,
 * the only limit is how fast you can click (a tiny delay between shots stops macros/auto-clickers).
 * Hits harder the closer the target is. Like the Piercing Bullet it does extra damage to a
 * stunned target and gives a tiny hitstun.
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

  update({ world, tuning, fighter: f, slot, pressed }) {
    const g = tuning.sheriff.gun;
    if (!pressed || !isReady(f, slot) || f.vars.rollT > 0) return;
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
      stunnedMultiplier: g.stunnedMultiplier,
      hitstun: tuning.hitstun.gun,
      physics: g.physics,
      from: { x: f.x, y: f.y },
    });
    emitSound(world, 'gun_fire', f.x, f.y);
    startCooldown(world, f, slot, g.fireInterval);
  },
};
