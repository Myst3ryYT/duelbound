/**
 * BUILDER - LC - Nail Gun (instant, projectile)
 * Hold to spray nails: very fast fire, low damage each, bullet-fast like the Sheriff's.
 * 30 nails, then it reloads by itself.
 * Numbers: tuning.builder.nailgun
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { spawnProjectile } from '../../projectiles.ts';
import { emitSound } from '../../events.ts';

export const nailgun: AbilityDef = {
  id: 'builder_nailgun',
  name: 'Nail Gun',
  type: 'projectile',
  activation: 'instant',
  icon: 'icon_builder_nailgun',
  cooldown: (t) => t.builder.nailgun.fireInterval,

  update({ world, tuning, fighter: f, slot, held }) {
    const n = tuning.builder.nailgun;
    if (f.vars.ammo === undefined) f.vars.ammo = n.ammo;

    // Reload finished? (the reload uses this slot's cooldown, so the HUD shows it)
    if (f.vars.reloading && isReady(f, slot)) {
      f.vars.reloading = 0;
      f.vars.ammo = n.ammo;
      emitSound(world, 'reload_done', f.x, f.y);
    }

    if (!held || !isReady(f, slot) || f.vars.reloading) return;
    // A little random-looking spread, worked out from the tick so it's the same on every computer.
    const wobble = (((world.tick * 37) % 11) / 10 - 0.5) * ((n.spread * Math.PI) / 180);
    const angle = f.aimAngle + wobble;
    spawnProjectile(world, tuning, {
      ownerId: f.id,
      kind: 'builder_nail',
      x: f.x + Math.cos(angle) * (f.radius + n.size + 2),
      y: f.y + Math.sin(angle) * (f.radius + n.size + 2),
      angle,
      speed: n.speed,
      radius: n.size,
      damage: n.damage,
      physics: n.physics,
      from: { x: f.x, y: f.y },
    });
    emitSound(world, 'nail_fire', f.x, f.y);
    f.vars.ammo -= 1;
    if (f.vars.ammo <= 0) {
      f.vars.reloading = 1;
      startCooldown(world, f, slot, n.reloadTime);
      emitSound(world, 'reload_start', f.x, f.y);
    } else {
      startCooldown(world, f, slot, n.fireInterval);
    }
  },
};
