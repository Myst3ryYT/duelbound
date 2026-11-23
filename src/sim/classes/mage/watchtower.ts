/**
 * MAGE - C - Watchtower (variable, static placeable)
 * Press C to see an outline at the crosshair, left click to place it.
 * After a build-up it fires bolts in 8 directions at regular intervals.
 * Its bolts belong to the Mage, so they only hurt the enemy.
 * Numbers: tuning.mage.watchtower
 */
import type { AbilityDef, PlaceableKindDef } from '../../abilities.ts';
import { canPlaceAt, removePlaceable, spawnPlaceable } from '../../placeables.ts';
import { spawnProjectile } from '../../projectiles.ts';
import { emitFx, emitSound } from '../../events.ts';

export const watchtower: AbilityDef = {
  id: 'mage_watchtower',
  name: 'Watchtower',
  type: 'placeable',
  activation: 'variable',
  icon: 'icon_mage_watchtower',
  cooldown: (t) => t.mage.watchtower.cooldown,

  preview(world, tuning, f) {
    const r = tuning.mage.watchtower.radius;
    return { sprite: 'mage_watchtower', x: f.aimX, y: f.aimY, angle: 0, radius: r, valid: canPlaceAt(world, tuning, f.aimX, f.aimY, r) };
  },

  confirm({ world, tuning, fighter: f }) {
    const w = tuning.mage.watchtower;
    if (!canPlaceAt(world, tuning, f.aimX, f.aimY, w.radius)) return false;
    spawnPlaceable(world, { ownerId: f.id, kind: 'mage_watchtower', x: f.aimX, y: f.aimY, angle: 0, radius: w.radius, hp: w.hp, maxHp: w.hp });
    emitSound(world, 'tower_build', f.aimX, f.aimY);
    return true;
  },
};

/** What a placed watchtower does every tick. */
export const watchtowerStructure: PlaceableKindDef = {
  kind: 'mage_watchtower',
  update(p, world, tuning, dt) {
    const w = tuning.mage.watchtower;
    if (p.age < w.startup) return; // still building
    if (p.age >= w.startup + w.life) {
      emitFx(world, 'ring', p.x, p.y, '#7fb0ff', p.radius * 1.5, 0.3);
      removePlaceable(world, p);
      return;
    }
    p.timer -= dt;
    if (p.timer > 0) return;
    p.timer = w.fireInterval;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4; // right, down-right, down, ... (all cardinals and diagonals)
      spawnProjectile(world, tuning, {
        ownerId: p.ownerId,
        kind: 'mage_tower_bolt',
        x: p.x + Math.cos(angle) * (p.radius + w.boltSize + 2),
        y: p.y + Math.sin(angle) * (p.radius + w.boltSize + 2),
        angle,
        speed: w.boltSpeed,
        radius: w.boltSize,
        damage: w.boltDamage,
      });
    }
    emitSound(world, 'tower_fire', p.x, p.y);
  },
};
