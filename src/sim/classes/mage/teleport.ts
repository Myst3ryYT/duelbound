/**
 * MAGE - SPACE - Teleport (instant, misc)
 * Teleports to the crosshair after a short animation. No maximum range, but the
 * spot can't be inside a wall, a structure or a player. An invalid spot does
 * nothing and doesn't use the cooldown. If the spot gets blocked during the
 * animation, the teleport fizzles and the cooldown is given back.
 * Numbers: tuning.mage.teleport
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, refundCooldown, startCooldown } from '../../abilities.ts';
import { canStandAt } from '../../placeables.ts';
import { emitFx, emitSound } from '../../events.ts';

export const teleport: AbilityDef = {
  id: 'mage_teleport',
  name: 'Teleport',
  type: 'misc',
  activation: 'instant',
  icon: 'icon_mage_teleport',
  cooldown: (t) => t.mage.teleport.cooldown,

  update({ world, tuning, fighter: f, slot, pressed, dt }) {
    const tp = tuning.mage.teleport;

    // Animation running: count down, then arrive.
    if (f.vars.tpActive) {
      f.vars.tpTime -= dt;
      if (f.vars.tpTime > 0) return;
      f.vars.tpActive = 0;
      if (!canStandAt(world, tuning, f, f.vars.tpX, f.vars.tpY)) {
        refundCooldown(f, slot);
        emitSound(world, 'fizzle', f.x, f.y);
        return;
      }
      emitFx(world, 'ring', f.x, f.y, '#7fb0ff', 40, 0.3);
      f.x = f.vars.tpX;
      f.y = f.vars.tpY;
      emitFx(world, 'burst', f.x, f.y, '#ffd34d', 40, 0.35);
      emitSound(world, 'teleport', f.x, f.y);
      return;
    }

    if (!pressed || !isReady(f, slot)) return;
    if (!canStandAt(world, tuning, f, f.aimX, f.aimY)) return; // invalid spot: nothing happens
    f.vars.tpActive = 1;
    f.vars.tpTime = tp.castTime;
    f.vars.tpX = f.aimX;
    f.vars.tpY = f.aimY;
    f.rootedT = tp.castTime;
    startCooldown(world, f, slot, tp.cooldown);
    emitSound(world, 'teleport_start', f.x, f.y);
  },
};
