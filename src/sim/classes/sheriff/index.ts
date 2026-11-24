/**
 * SHERIFF: sharpshooter with high mobility. Revolver first. Brown and red.
 * Each ability lives in its own file in this folder.
 */
import type { ClassDef } from '../../abilities.ts';
import { gun } from './gun.ts';
import { lasso, lassoHit } from './lasso.ts';
import { bramble, brambleObject } from './bramble.ts';
import { pierce } from './pierce.ts';
import { roll } from './roll.ts';

export const SHERIFF: ClassDef = {
  id: 'sheriff',
  name: 'Sheriff',
  sprite: 'class_sheriff',
  ratings: { difficulty: 3, mobility: 3, damage: 4, defense: 3 },
  abilities: {
    primary: gun, // LC
    secondary: lasso, // RC
    ability1: bramble, // C
    ability2: pierce, // V
    mobility: roll, // SPACE
  },
  objects: [brambleObject],
  projectileHooks: { lasso: lassoHit },

  // Piercing Bullet aiming delay shown as a bar under the crosshair.
  crosshairBar(f, t) {
    if (!(f.vars.pierceT > 0)) return null;
    const d = Math.max(0.001, t.sheriff.pierce.delay);
    return { fill: 1 - f.vars.pierceT / d, rate: 1 / d, color: '#e05050' };
  },
};
