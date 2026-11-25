/**
 * FROG - RC - Belch (charge, projectile)
 * Hold to charge, let go to belch a ball of gas towards the crosshair.
 * The longer you hold, the faster and harder it hits, but charging keeps
 * using slime (a tap costs minCost; holding drains more). Charging stops
 * growing when the slime runs out. Flies buzz around it (looks only).
 * Getting hit only pauses the charge (a real stun cancels it).
 * Numbers: tuning.frog.belch
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { spawnProjectile } from '../../projectiles.ts';
import { emitSound } from '../../events.ts';
import { lerp } from '../../math.ts';
import { drainSlime, spendSlime } from './slime.ts';

export const belch: AbilityDef = {
  id: 'frog_belch',
  name: 'Belch',
  type: 'projectile',
  activation: 'instant',
  icon: 'icon_frog_belch',
  cooldown: (t) => t.frog.belch.cooldown,

  update({ world, tuning, fighter: f, slot, pressed, held, stunned, dt }) {
    const b = tuning.frog.belch;

    // Start charging (a tap still costs the minimum).
    if (!f.vars.belchOn) {
      if (!pressed || !isReady(f, slot) || f.vars.airT > 0) return;
      if (!spendSlime(f, tuning, b.minCost)) return;
      f.vars.belchOn = 1;
      f.vars.belchT = 0;
      return;
    }

    if (f.stunT > 0) {
      f.vars.belchOn = 0; // a real stun wastes the charge
      return;
    }
    if (stunned) return; // a mere flinch (hitstun from a hit) just pauses the charge: it isn't lost and doesn't fire early

    // Keep charging while held (and while there's slime to spend).
    if (held) {
      if (f.vars.belchT < b.maxCharge) {
        const spent = drainSlime(f, tuning, b.drain * dt);
        if (spent > 0) f.vars.belchT = Math.min(b.maxCharge, f.vars.belchT + dt * (spent / (b.drain * dt)));
      }
      return;
    }

    // Let go: belch!
    const k = b.maxCharge > 0 ? f.vars.belchT / b.maxCharge : 1;
    const size = lerp(b.minSize, b.maxSize, k);
    f.vars.belchOn = 0;
    spawnProjectile(world, tuning, {
      ownerId: f.id,
      kind: 'frog_belch',
      behavior: 'frog_belch', // (hits a marked enemy for extra, see slime.ts)
      x: f.x + Math.cos(f.aimAngle) * (f.radius + size + 4),
      y: f.y + Math.sin(f.aimAngle) * (f.radius + size + 4),
      angle: f.aimAngle,
      speed: lerp(b.minSpeed, b.maxSpeed, k),
      radius: size,
      damage: lerp(b.minDamage, b.maxDamage, k),
      from: { x: f.x, y: f.y },
    });
    startCooldown(world, f, slot, b.cooldown);
    emitSound(world, 'frog_belch', f.x, f.y);
  },
};
