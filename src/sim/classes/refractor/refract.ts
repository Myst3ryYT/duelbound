/**
 * REFRACTOR - V - Refract (instant, misc)
 * Splits into a "red" and a "blue" half for a moment, side by side across
 * your aim. Good for letting a shot pass between the halves. Both halves can
 * be hit and either one hurts you. The hit check lives in sim/hitbox.ts.
 * Numbers: tuning.refractor.refract
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { emitSound } from '../../events.ts';

export const refract: AbilityDef = {
  id: 'refractor_refract',
  name: 'Refract',
  type: 'misc',
  activation: 'instant',
  icon: 'icon_refractor_refract',
  cooldown: (t) => t.refractor.refract.cooldown,

  update({ world, tuning, fighter: f, slot, pressed, dt }) {
    if (f.vars.refractT > 0) f.vars.refractT = Math.max(0, f.vars.refractT - dt);
    if (!pressed || !isReady(f, slot)) return;
    const r = tuning.refractor.refract;
    f.vars.refractT = r.duration;
    f.vars.refractAngle = f.aimAngle + Math.PI / 2; // across the aim direction
    f.vars.refractSep = r.separation;
    startCooldown(world, f, slot, r.cooldown);
    emitSound(world, 'refract', f.x, f.y);
  },
};
