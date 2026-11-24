/**
 * MAGE - RC - Reflective Shield (instant, placeable) - 2 charges
 * Puts up a curved reflective wall in front of the Mage that slowly drifts
 * forward (the way the Mage was facing). Enemy shots bounce off it and become
 * the Mage's. The Mage's own shots and the Mage pass straight through it.
 * Enemy hits wear it down; it breaks by itself after a few seconds.
 *
 * The curve is made of a few short straight pieces (like mirrors), so all the
 * normal bouncing rules work on it.
 * Numbers: tuning.mage.shield
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { spawnPlaceable } from '../../placeables.ts';
import { emitSound } from '../../events.ts';

export const shield: AbilityDef = {
  id: 'mage_shield',
  name: 'Reflective Shield',
  type: 'placeable',
  activation: 'instant',
  icon: 'icon_mage_shield',
  cooldown: (t) => t.mage.shield.chargeTime,
  charges: (t) => t.mage.shield.charges,

  update({ world, tuning, fighter: f, slot, pressed }) {
    if (!pressed || !isReady(f, slot)) return;
    const s = tuning.mage.shield;
    const facing = f.aimAngle;
    const span = (s.arcDegrees * Math.PI) / 180;
    const pieces = Math.max(1, Math.round(s.pieces));
    // Points along an arc centred on the Mage, bulging forward.
    const point = (i: number) => {
      const a = facing - span / 2 + (span * i) / pieces;
      return { x: f.x + Math.cos(a) * s.distance, y: f.y + Math.sin(a) * s.distance };
    };
    for (let i = 0; i < pieces; i++) {
      const a = point(i);
      const b = point(i + 1);
      spawnPlaceable(world, {
        ownerId: f.id,
        kind: 'mage_shield',
        shape: 'segment',
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
        radius: s.thickness / 2,
        hp: s.hp,
        maxHp: s.hp,
        reflective: true,
        claims: true,
        ownerPasses: true,
        breakT: s.duration,
        vx: Math.cos(facing) * s.speed,
        vy: Math.sin(facing) * s.speed,
      });
    }
    startCooldown(world, f, slot, s.chargeTime);
    emitSound(world, 'shield_up', f.x, f.y);
  },
};
