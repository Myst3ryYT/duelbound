/**
 * FROG - SPACE - Hop (instant, mobility)
 * A quick hop in the direction you're moving (towards the crosshair if you're
 * standing still). Costs a little slime. In the air the Frog sails over structures,
 * physics objects and slime, and nothing can hit him (he's invulnerable).
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

  update({ world, tuning, fighter: f, input, slot, pressed, dt }) {
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
    if (!spendSlime(f, tuning, h.cost)) return;

    // Hop the way you're moving (keys, or the slide when gliding); standing still, towards the crosshair.
    let dx = input.moveX;
    let dy = input.moveY;
    if (Math.hypot(dx, dy) < 0.01 && f.vars.goopOn) {
      dx = f.vars.goopVx;
      dy = f.vars.goopVy;
    }
    const len = Math.hypot(dx, dy);
    if (len < 0.01) {
      dx = Math.cos(f.aimAngle);
      dy = Math.sin(f.aimAngle);
    } else {
      dx /= len;
      dy /= len;
    }
    f.vars.hopDX = dx;
    f.vars.hopDY = dy;
    f.vars.airT = h.duration;
    f.rootedT = h.duration; // normal walking is off during the hop
    f.invulnT = Math.max(f.invulnT, h.duration); // in the air nothing can hit you
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
