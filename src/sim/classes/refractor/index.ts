/**
 * REFRACTOR: multiplies and ricochets shots with mirrors. Glassy, refractive look.
 * Each ability lives in its own file in this folder.
 */
import type { ClassDef } from '../../abilities.ts';
import { shotgun } from './shotgun.ts';
import { ray } from './ray.ts';
import { mirror } from './mirror.ts';
import { refract } from './refract.ts';
import { shatter } from './shatter.ts';

export const REFRACTOR: ClassDef = {
  id: 'refractor',
  name: 'Refractor',
  sprite: 'class_refractor',
  abilities: {
    primary: shotgun, // LC
    secondary: ray, // RC
    ability1: mirror, // C
    ability2: refract, // V
    mobility: shatter, // SPACE
  },

  // Mind Ray resource pool, shown next to the crosshair whenever it isn't full.
  crosshairBar(f, t) {
    const r = t.refractor.ray;
    const pool = f.vars.rayPool ?? r.pool;
    if (pool >= r.pool && !f.vars.rayOn) return null;
    const refilling = !f.vars.rayOn && (f.vars.rayIdle ?? 0) >= r.refillDelay;
    const rate = f.vars.rayOn ? -r.drain / r.pool : refilling ? r.refill / r.pool : 0;
    return { fill: pool / r.pool, rate, color: '#c58cff' };
  },
};
