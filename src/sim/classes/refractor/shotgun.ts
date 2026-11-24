/**
 * REFRACTOR - LC - Mind Shotgun (instant, projectile)
 * Fires a tight spread of pellets. Hold to keep firing.
 * A pellet that bounces off one of YOUR mirrors becomes two. Each pellet can double
 * off up to 3 mirrors (copies inherit their parent's count), so through 3 mirrors a
 * volley goes 4 -> 8 -> 16 -> 32.
 * The doubling itself happens in sim/projectiles.ts (splitPellet).
 * Numbers: tuning.refractor.shotgun
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { spawnProjectile } from '../../projectiles.ts';
import { emitSound } from '../../events.ts';

export const shotgun: AbilityDef = {
  id: 'refractor_shotgun',
  name: 'Mind Shotgun',
  type: 'projectile',
  activation: 'instant',
  icon: 'icon_refractor_shotgun',
  cooldown: (t) => t.refractor.shotgun.fireInterval,

  update({ world, tuning, fighter: f, slot, held }) {
    if (!held || !isReady(f, slot)) return;
    const s = tuning.refractor.shotgun;
    const count = Math.max(1, Math.round(s.pellets));
    const spread = (s.spread * Math.PI) / 180;
    for (let i = 0; i < count; i++) {
      // Spread evenly from one edge of the cone to the other.
      const angle = f.aimAngle + (count === 1 ? 0 : -spread / 2 + (spread * i) / (count - 1));
      spawnProjectile(world, tuning, {
        ownerId: f.id,
        kind: 'refractor_pellet',
        x: f.x + Math.cos(f.aimAngle) * (f.radius + s.size + 2),
        y: f.y + Math.sin(f.aimAngle) * (f.radius + s.size + 2),
        angle,
        speed: s.speed,
        radius: s.size,
        damage: s.damage,
        splits: true,
        from: { x: f.x, y: f.y },
      });
    }
    startCooldown(world, f, slot, s.fireInterval);
    emitSound(world, 'shotgun_fire', f.x, f.y);
  },
};
