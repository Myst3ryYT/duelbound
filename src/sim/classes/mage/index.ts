/**
 * MAGE: magic staff user. Gold and blue.
 * Each ability lives in its own file in this folder.
 */
import type { ClassDef } from '../../abilities.ts';
import { staff } from './staff.ts';
import { shield } from './shield.ts';
import { watchtower, watchtowerStructure } from './watchtower.ts';
import { switchAbility } from './switch.ts';
import { teleport } from './teleport.ts';

export const MAGE: ClassDef = {
  id: 'mage',
  name: 'Mage',
  sprite: 'class_mage',
  abilities: {
    primary: staff, // LC
    secondary: shield, // RC
    ability1: watchtower, // C
    ability2: switchAbility, // V
    mobility: teleport, // SPACE
  },
  placeables: [watchtowerStructure],
  crosshairCharges: 'secondary', // shields left, shown above the crosshair
};
