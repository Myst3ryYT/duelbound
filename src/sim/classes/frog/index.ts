/**
 * FROG: slippery brawler. Tongue whip up close, charged belches, a slime trail
 * that speeds him up and hurts enemies, and a mouth that swallows enemy shots.
 * Most of his kit runs on the slime pool (his mana, see slime.ts).
 * Each ability lives in its own file in this folder.
 */
import type { ClassDef } from '../../abilities.ts';
import { tongue } from './tongue.ts';
import { belch } from './belch.ts';
import { goop } from './goop.ts';
import { swallow } from './swallow.ts';
import { hop } from './hop.ts';
import { slimeOf, slimeZone, tickSlime } from './slime.ts';

export const FROG: ClassDef = {
  id: 'frog',
  name: 'Frog',
  sprite: 'class_frog',
  ratings: { difficulty: 4, mobility: 4, damage: 3, defense: 3 },
  abilities: {
    primary: tongue, // LC
    secondary: belch, // RC
    ability1: goop, // C
    ability2: swallow, // V
    mobility: hop, // SPACE
  },
  zones: [slimeZone],

  tick: (_world, tuning, f, dt) => tickSlime(f, tuning, dt),

  // The slime pool by the crosshair (yellow while charging a belch).
  crosshairBar(f, t) {
    const pool = Math.max(1, t.frog.slime.pool);
    if (f.vars.belchOn) return { fill: slimeOf(f, t) / pool, color: '#d8e05a' };
    return { fill: slimeOf(f, t) / pool, color: '#5ac85a' };
  },
};
