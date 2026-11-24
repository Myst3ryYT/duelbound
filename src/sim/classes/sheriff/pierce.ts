/**
 * SHERIFF - V - Piercing Bullet (instant, projectile)
 * After a short aiming delay (a red line shows where it will go), fires an
 * extremely fast bullet. It does triple damage to a stunned target (e.g. one
 * caught by a tumbleweed). It leaves a trail for a moment (looks only).
 * It fires wherever you are aiming when the delay ends.
 * Numbers: tuning.sheriff.pierce
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { spawnProjectile } from '../../projectiles.ts';
import { emitSound } from '../../events.ts';

export const pierce: AbilityDef = {
  id: 'sheriff_pierce',
  name: 'Piercing Bullet',
  type: 'projectile',
  activation: 'instant',
  icon: 'icon_sheriff_pierce',
  cooldown: (t) => t.sheriff.pierce.cooldown,

  update({ world, tuning, fighter: f, slot, pressed, stunned, dt }) {
    const p = tuning.sheriff.pierce;

    if (f.vars.pierceT > 0) {
      if (stunned) {
        f.vars.pierceT = 0; // a stun interrupts the shot (cooldown is still used)
        return;
      }
      f.vars.pierceT -= dt;
      if (f.vars.pierceT > 0) return;
      spawnProjectile(world, tuning, {
        ownerId: f.id,
        kind: 'sheriff_pierce',
        x: f.x + Math.cos(f.aimAngle) * (f.radius + p.size + 4),
        y: f.y + Math.sin(f.aimAngle) * (f.radius + p.size + 4),
        angle: f.aimAngle,
        speed: p.speed,
        radius: p.size,
        damage: p.damage,
        stunnedMultiplier: p.stunnedMultiplier,
        trail: p.trail,
        from: { x: f.x, y: f.y },
      });
      emitSound(world, 'pierce_fire', f.x, f.y);
      return;
    }

    if (!pressed || !isReady(f, slot)) return;
    f.vars.pierceT = p.delay;
    startCooldown(world, f, slot, p.cooldown);
    emitSound(world, 'pierce_charge', f.x, f.y);
  },
};
