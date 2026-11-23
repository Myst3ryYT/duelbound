/**
 * SHERIFF - LC - Gun (instant, projectile)
 * Fast revolver shots. Hold to keep firing. Hits harder the closer the target is.
 * Six shots, then it reloads by itself (no button needed).
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
    const g = tuning.sheriff.gun;
    if (f.vars.ammo === undefined) f.vars.ammo = g.ammo;

    // Reload finished? (the reload uses this slot's cooldown, so the HUD shows it)
    if (f.vars.reloading && isReady(f, slot)) {
      f.vars.reloading = 0;
      f.vars.ammo = g.ammo;
      emitSound(world, 'reload_done', f.x, f.y);
    }

    if (!held || !isReady(f, slot) || f.vars.rollT > 0 || f.vars.reloading) return;
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
    emitSound(world, 'gun_fire', f.x, f.y);

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
