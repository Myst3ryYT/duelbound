/**
 * FROG - SPACE - Hop (instant, mobility)
 * A quick hop towards the crosshair. In the air the Frog sails over structures,
 * physics objects and slime (shots can still hit him).
 * Hopping out of Acid Goop mode splashes a big slime puddle where he lands,
 * if he has the slime for it (landCost).
 * Numbers: tuning.frog.hop
 *
 * Shared fighter variable: vars.airT > 0 means "in the air" (placeables.ts,
 * objects.ts and zones.ts let airborne fighters pass).
 */
import type { AbilityDef } from '../../abilities.ts';
import type { Tuning } from '../../../config/tuning.ts';
import type { Fighter, World } from '../../types.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { emitFx, emitSound } from '../../events.ts';
import { dropSlime, spendSlime } from './slime.ts';

export const hop: AbilityDef = {
  id: 'frog_hop',
  name: 'Hop',
  type: 'misc',
  activation: 'instant',
  icon: 'icon_frog_hop',
  cooldown: (t) => t.frog.hop.cooldown,

  update({ world, tuning, fighter: f, slot, pressed, dt }) {
    const h = tuning.frog.hop;

    // In the air: move along the hop.
    if (f.vars.airT > 0) {
      const speed = h.distance / Math.max(0.001, h.duration);
      const step = Math.min(dt, f.vars.airT);
      f.x += f.vars.hopDX * speed * step;
      f.y += f.vars.hopDY * speed * step;
      f.vars.airT -= dt;
      if (f.vars.airT <= 0) land(world, tuning, f);
      return;
    }

    if (!pressed || !isReady(f, slot) || f.stunT > 0 || f.hitstunT > 0 || f.pullById) return;
    f.vars.hopDX = Math.cos(f.aimAngle);
    f.vars.hopDY = Math.sin(f.aimAngle);
    f.vars.airT = h.duration;
    f.rootedT = h.duration; // normal walking is off during the hop
    startCooldown(world, f, slot, h.cooldown);
    emitSound(world, 'frog_hop', f.x, f.y);

  },
};

/** Touch down. Out of goop mode (and with enough slime), splash a big puddle. */
function land(world: World, tuning: Tuning, f: Fighter): void {
  const h = tuning.frog.hop;
  f.vars.airT = 0;
  if (f.vars.goopOn && spendSlime(f, tuning, h.landCost)) {
    dropSlime(world, tuning, f, h.landRadius, h.landLife);
    emitFx(world, 'burst', f.x, f.y, '#7ad05a', h.landRadius, 0.35);
    emitSound(world, 'frog_splash', f.x, f.y);
  }
}
