/**
 * BUILDER: builds cover, then smashes it into the enemy. Orange hard hat, brick red.
 * Each ability lives in its own file in this folder.
 */
import type { ClassDef } from '../../abilities.ts';
import { nailgun } from './nailgun.ts';
import { hammer } from './hammer.ts';
import { wall } from './wall.ts';
import { construction, furnitureObjects } from './construction.ts';
import { makeDash } from '../shared/dash.ts';

export const BUILDER: ClassDef = {
  id: 'builder',
  name: 'Builder',
  sprite: 'class_builder',
  ratings: { difficulty: 3, mobility: 2, damage: 3, defense: 4 },
  abilities: {
    primary: nailgun, // LC
    secondary: hammer, // RC
    ability1: wall, // C
    ability2: construction, // V
    mobility: makeDash('builder_dash', 'icon_builder_dash', (t) => t.builder.dash), // SPACE
  },
  objects: furnitureObjects,
  crosshairCharges: 'ability1', // walls left, shown above the crosshair

  // Nails left.
  ammo(f, t) {
    return { current: f.vars.ammo ?? t.builder.nailgun.ammo, max: t.builder.nailgun.ammo, reloading: !!f.vars.reloading };
  },
};
