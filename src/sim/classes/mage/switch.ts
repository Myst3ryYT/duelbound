/**
 * MAGE - V - Switch (instant, misc)
 * Every projectile and physics object in the arena (yours too) slows to a stop
 * and then flies back the way it came. The motion itself is in sim/switching.ts.
 * Numbers: tuning.mage.switch
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { startSwitch } from '../../switching.ts';
import { emitFx, emitSound } from '../../events.ts';

export const switchAbility: AbilityDef = {
  id: 'mage_switch',
  name: 'Switch',
  type: 'misc',
  activation: 'instant',
  icon: 'icon_mage_switch',
  disabled: true, // switched off for now (remove this line to bring it back)
  cooldown: (t) => t.mage.switch.cooldown,

  update({ world, tuning, fighter: f, slot, pressed }) {
    if (!pressed || !isReady(f, slot)) return;
    const turn = tuning.mage.switch.turnTime;
    for (const p of world.projectiles) startSwitch(p, turn);
    for (const o of world.objects) startSwitch(o, turn);
    startCooldown(world, f, slot, tuning.mage.switch.cooldown);
    emitSound(world, 'switch', f.x, f.y);
    emitFx(world, 'ring', f.x, f.y, '#ffd34d', tuning.world.arenaSize * 0.75, 0.5);
  },
};
