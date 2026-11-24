/**
 * REFRACTOR - V - Shatter (instant, misc)
 * Shatters every mirror in the arena at once. Each enemy takes damage for
 * every mirror they are close to (near two mirrors = hit twice).
 * Does nothing (and uses no cooldown) if there are no mirrors.
 * Numbers: tuning.refractor.shatter
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { distanceTo } from '../../placeables.ts';
import { applyDamage } from '../../damage.ts';
import { emitFx, emitSound } from '../../events.ts';

export const shatter: AbilityDef = {
  id: 'refractor_shatter',
  name: 'Shatter',
  type: 'misc',
  activation: 'instant',
  icon: 'icon_refractor_shatter',
  cooldown: (t) => t.refractor.shatter.cooldown,

  update({ world, tuning, fighter: f, slot, pressed }) {
    if (!pressed || !isReady(f, slot)) return;
    const s = tuning.refractor.shatter;
    const mirrors = world.placeables.filter((p) => p.reflective);
    if (mirrors.length === 0) return;

    for (const target of world.fighters) {
      if (target.id === f.id || target.invulnT > 0) continue; // only enemies get hurt
      const near = mirrors.filter((m) => distanceTo(m, target.x, target.y) <= s.radius).length;
      if (near > 0) applyDamage(world, target, s.damage * near, f.id);
    }
    for (const m of mirrors) {
      emitFx(world, 'ring', m.x, m.y, '#bfe8ff', s.radius, 0.4);
      emitFx(world, 'burst', m.x, m.y, '#e8f8ff', 60, 0.4);
    }
    world.placeables = world.placeables.filter((p) => !p.reflective);
    startCooldown(world, f, slot, s.cooldown);
    emitSound(world, 'shatter', f.x, f.y);
  },
};
