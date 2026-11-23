/**
 * Training dummy behaviour: stands still, and (if switched on) shoots at the player.
 * Its shots are ordinary projectiles, so shields, Switch and rolls all work on them.
 * Numbers: tuning.training
 */
import type { Tuning } from '../config/tuning.ts';
import type { Fighter, World } from './types.ts';
import { spawnProjectile } from './projectiles.ts';
import { emitSound } from './events.ts';

export function updateDummy(world: World, tuning: Tuning, dummy: Fighter, dt: number): void {
  const tr = tuning.training;
  if (!world.options.dummyFires || dummy.stunT > 0 || dummy.hp <= 0) return;
  const target = world.fighters.find((f) => f.kind === 'player');
  if (!target) return;
  dummy.aimAngle = Math.atan2(target.y - dummy.y, target.x - dummy.x);

  dummy.vars.fireTimer = (dummy.vars.fireTimer ?? tr.dummyFireInterval) - dt;
  if (dummy.vars.fireTimer > 0) return;
  dummy.vars.fireTimer = tr.dummyFireInterval;
  spawnProjectile(world, tuning, {
    ownerId: dummy.id,
    kind: 'dummy_shot',
    x: dummy.x + Math.cos(dummy.aimAngle) * (dummy.radius + tr.dummyShotSize + 2),
    y: dummy.y + Math.sin(dummy.aimAngle) * (dummy.radius + tr.dummyShotSize + 2),
    angle: dummy.aimAngle,
    speed: tr.dummyShotSpeed,
    radius: tr.dummyShotSize,
    damage: tr.dummyShotDamage,
  });
  emitSound(world, 'dummy_fire', dummy.x, dummy.y);
}
