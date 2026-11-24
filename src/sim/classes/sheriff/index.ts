/**
 * SHERIFF: sharpshooter with high mobility. Revolver first. Brown and red.
 * Each ability lives in its own file in this folder.
 */
import type { ClassDef } from '../../abilities.ts';
import { gun } from './gun.ts';
import { lasso, lassoHit } from './lasso.ts';
import { bramble, brambleObject } from './bramble.ts';
import { horse, horseBar } from './horse.ts';
import { roll } from './roll.ts';

export const SHERIFF: ClassDef = {
  id: 'sheriff',
  name: 'Sheriff',
  sprite: 'class_sheriff',
  ratings: { difficulty: 3, mobility: 4, damage: 4, defense: 3 },
  abilities: {
    primary: gun, // LC
    secondary: lasso, // RC
    ability1: bramble, // C
    ability2: horse, // V
    mobility: roll, // SPACE
  },
  objects: [brambleObject],
  projectileHooks: { lasso: lassoHit },

  // Revolver bullets left.
  ammo(f, t) {
    return { current: f.vars.ammo ?? t.sheriff.gun.ammo, max: t.sheriff.gun.ammo, reloading: !!f.vars.reloading };
  },

  // Time left on the horse, as a bar under the crosshair.
  crosshairBar: horseBar,
};
