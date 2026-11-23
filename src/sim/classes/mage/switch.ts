/**
 * MAGE - V - Switch (instant, misc)
 * Every projectile in the arena (yours too) slows down and curves back the
 * opposite way. Physics objects will be added here when they exist (Sheriff's Bramble).
 * Numbers: tuning.mage.switch
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { startSwitch } from '../../projectiles.ts';
import { emitFx, emitSound } from '../../events.ts';

export const switchAbility: AbilityDef = {
  id: 'mage_switch',
  name: 'Switch',
  type: 'misc',
  activation: 'instant',
  icon: 'icon_mage_switch',
  cooldown: (t) => t.mage.switch.cooldown,

  update({ world, tuning, fighter: f, slot, pressed }) {
    if (!pressed || !isReady(f, slot)) return;
    for (const p of world.projectiles) startSwitch(p, tuning.mage.switch.turnTime);
    startCooldown(world, f, slot, tuning.mage.switch.cooldown);
    emitSound(world, 'switch', f.x, f.y);
    emitFx(world, 'ring', f.x, f.y, '#ffd34d', tuning.world.arenaSize * 0.75, 0.5);
  },
};
