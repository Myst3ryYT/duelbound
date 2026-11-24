/**
 * SHERIFF - RC - Lasso (instant, projectile/misc)
 * Throws a lasso. If it catches the enemy, it deals a little damage and drags
 * them to the Sheriff. Structures block it; it flies straight through tumbleweeds.
 * A Mage's reflective shield snaps it.
 * Numbers: tuning.sheriff.lasso
 */
import type { AbilityDef, ProjectileHook } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { spawnProjectile } from '../../projectiles.ts';
import { startPull } from '../../status.ts';
import { emitSound } from '../../events.ts';

export const lasso: AbilityDef = {
  id: 'sheriff_lasso',
  name: 'Lasso',
  type: 'projectile',
  activation: 'instant',
  icon: 'icon_sheriff_lasso',
  cooldown: (t) => t.sheriff.lasso.cooldown,

  update({ world, tuning, fighter: f, slot, pressed }) {
    if (!pressed || !isReady(f, slot)) return;
    const l = tuning.sheriff.lasso;
    spawnProjectile(world, tuning, {
      ownerId: f.id,
      kind: 'sheriff_lasso',
      behavior: 'lasso',
      x: f.x + Math.cos(f.aimAngle) * (f.radius + l.size),
      y: f.y + Math.sin(f.aimAngle) * (f.radius + l.size),
      angle: f.aimAngle,
      speed: l.speed,
      radius: l.size,
      damage: l.damage,
      reflectable: false,
      life: l.range / Math.max(1, l.speed), // vanishes at max range
      from: { x: f.x, y: f.y },
    });
    startCooldown(world, f, slot, l.cooldown);
    emitSound(world, 'lasso_throw', f.x, f.y);
  },
};

/** When the lasso catches someone: drag them to whoever threw it. */
export const lassoHit: ProjectileHook = (world, tuning, p, target) => {
  const owner = world.fighters.find((f) => f.id === p.ownerId);
  if (!owner) return;
  const l = tuning.sheriff.lasso;
  const maxTime = (l.range * 1.5) / Math.max(1, l.pullSpeed) + 0.2;
  startPull(target, owner, l.pullSpeed, maxTime);
  emitSound(world, 'lasso_hit', target.x, target.y);
};
