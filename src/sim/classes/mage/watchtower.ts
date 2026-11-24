/**
 * MAGE - C - Watchtower (variable, static placeable)
 * Press C to see an outline at the crosshair, left click to place it.
 * After a short build-up it gives off an aura: while the Mage stands inside it,
 * the staff fires faster. It doesn't shoot. Enemies can shoot it down.
 * Numbers: tuning.mage.watchtower
 */
import type { Tuning } from '../../../config/tuning.ts';
import type { AbilityDef, PlaceableKindDef } from '../../abilities.ts';
import type { Fighter, World } from '../../types.ts';
import { canPlaceAt, removePlaceable, spawnPlaceable } from '../../placeables.ts';
import { emitFx, emitSound } from '../../events.ts';
import { dist } from '../../math.ts';

export const watchtower: AbilityDef = {
  id: 'mage_watchtower',
  name: 'Watchtower',
  type: 'placeable',
  activation: 'variable',
  icon: 'icon_mage_watchtower',
  cooldown: (t) => t.mage.watchtower.cooldown,

  preview(world, tuning, _f, x, y) {
    const r = tuning.mage.watchtower.radius;
    return { sprite: 'mage_watchtower', x, y, angle: 0, radius: r, valid: canPlaceAt(world, tuning, x, y, r) };
  },

  confirm({ world, tuning, fighter: f }) {
    const w = tuning.mage.watchtower;
    if (!canPlaceAt(world, tuning, f.aimX, f.aimY, w.radius)) return false;
    spawnPlaceable(world, { ownerId: f.id, kind: 'mage_watchtower', x: f.aimX, y: f.aimY, angle: 0, radius: w.radius, hp: w.hp, maxHp: w.hp });
    emitSound(world, 'tower_build', f.aimX, f.aimY);
    return true;
  },
};

/** Is this Mage standing in the aura of one of their own finished watchtowers? */
export function inWatchtowerAura(world: World, tuning: Tuning, f: Fighter): boolean {
  const w = tuning.mage.watchtower;
  return world.placeables.some((p) => p.kind === 'mage_watchtower' && p.ownerId === f.id && p.age >= w.startup && dist(p.x, p.y, f.x, f.y) <= w.auraRadius);
}

/** What a placed watchtower does every tick: just times out. */
export const watchtowerStructure: PlaceableKindDef = {
  kind: 'mage_watchtower',
  update(p, world, tuning) {
    const w = tuning.mage.watchtower;
    if (p.age >= w.startup + w.life) {
      emitFx(world, 'ring', p.x, p.y, '#7fb0ff', p.radius * 1.5, 0.3);
      removePlaceable(world, p);
    }
  },
};
