/**
 * MAGE - RC - Reflective Shield (instant, misc)
 * A bubble that bounces enemy projectiles away. Reflected projectiles become the Mage's.
 * The Mage can still move and attack while it is up.
 * The reflecting itself happens in sim/projectiles.ts (any fighter with shieldT > 0).
 * Numbers: tuning.mage.shield
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { emitSound } from '../../events.ts';

export const shield: AbilityDef = {
  id: 'mage_shield',
  name: 'Reflective Shield',
  type: 'misc',
  activation: 'instant',
  icon: 'icon_mage_shield',
  cooldown: (t) => t.mage.shield.cooldown,

  update({ world, tuning, fighter: f, slot, pressed }) {
    if (!pressed || !isReady(f, slot)) return;
    f.shieldT = tuning.mage.shield.duration;
    f.shieldRadius = tuning.mage.shield.radius;
    startCooldown(world, f, slot, tuning.mage.shield.cooldown);
    emitSound(world, 'shield_up', f.x, f.y);
  },
};
