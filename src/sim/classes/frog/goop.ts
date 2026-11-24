/**
 * FROG - C - Acid Goop (toggle, movement)
 * Press to start gliding, press again to stop (it also stops when the slime runs out).
 * While gliding the Frog is fast but slippery: he speeds up and turns slowly and
 * keeps sliding when you let go. He leaves a trail of slime puddles behind him
 * (see slime.ts for what slime does). Gliding uses slime the whole time.
 * Hopping out of goop mode splashes a big puddle on landing (see hop.ts).
 * Numbers: tuning.frog.goop
 */
import type { AbilityDef } from '../../abilities.ts';
import type { Tuning } from '../../../config/tuning.ts';
import type { Fighter, World } from '../../types.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { emitSound } from '../../events.ts';
import { drainSlime, dropSlime, slimeOf } from './slime.ts';

export const goop: AbilityDef = {
  id: 'frog_goop',
  name: 'Acid Goop',
  type: 'misc',
  activation: 'instant',
  icon: 'icon_frog_goop',
  cooldown: (t) => t.frog.goop.cooldown,

  update({ world, tuning, fighter: f, input, slot, pressed, dt }) {
    const g = tuning.frog.goop;

    if (!f.vars.goopOn) {
      if (!pressed || !isReady(f, slot) || slimeOf(f, tuning) <= 0) return;
      f.vars.goopOn = 1;
      f.vars.goopVx = f.vx; // keep the walking speed you had
      f.vars.goopVy = f.vy;
      f.vars.goopDist = g.trailSpacing; // drop a puddle right away
      emitSound(world, 'frog_goop', f.x, f.y);
      return;
    }

    // Gliding: stop on a second press or when the slime runs out.
    if (pressed || drainSlime(f, tuning, g.drain * dt) <= 0) {
      stopGoop(world, tuning, f, slot);
      return;
    }
    f.rootedT = Math.max(f.rootedT, dt * 2); // normal walking is off: we move ourselves
    if (f.stunT > 0 || f.hitstunT > 0 || f.pullById) {
      f.vars.goopVx = 0; // a stun (or being dragged) kills the slide
      f.vars.goopVy = 0;
      return;
    }
    if (f.vars.airT > 0) return; // hopping: hop.ts moves us

    glide(world, tuning, f, input.moveX, input.moveY, dt);
  },
};

/** One tick of slippery gliding. */
function glide(world: World, tuning: Tuning, f: Fighter, moveX: number, moveY: number, dt: number): void {
  const g = tuning.frog.goop;
  const top = g.speed * (f.vars.speedMult || 1); // own slime makes it faster
  const len = Math.hypot(moveX, moveY);
  if (len > 0.01) {
    f.vars.goopVx += (moveX / len) * g.accel * dt;
    f.vars.goopVy += (moveY / len) * g.accel * dt;
  } else {
    const drag = Math.exp(-g.friction * dt);
    f.vars.goopVx *= drag;
    f.vars.goopVy *= drag;
  }
  const speed = Math.hypot(f.vars.goopVx, f.vars.goopVy);
  if (speed > top) {
    f.vars.goopVx *= top / speed;
    f.vars.goopVy *= top / speed;
  }
  f.x += f.vars.goopVx * dt;
  f.y += f.vars.goopVy * dt;
  f.vx = f.vars.goopVx; // (so the walking animation plays)
  f.vy = f.vars.goopVy;

  // Hitting the arena edge stops the slide that way.
  const size = tuning.world.arenaSize;
  if (f.x <= f.radius || f.x >= size - f.radius) f.vars.goopVx = 0;
  if (f.y <= f.radius || f.y >= size - f.radius) f.vars.goopVy = 0;

  // Leave a trail.
  f.vars.goopDist += Math.hypot(f.vars.goopVx, f.vars.goopVy) * dt;
  if (f.vars.goopDist >= g.trailSpacing) {
    f.vars.goopDist = 0;
    dropSlime(world, tuning, f, g.trailRadius, g.trailLife);
  }
}

function stopGoop(world: World, tuning: Tuning, f: Fighter, slot: Parameters<typeof startCooldown>[2]): void {
  f.vars.goopOn = 0;
  startCooldown(world, f, slot, tuning.frog.goop.cooldown);
  emitSound(world, 'frog_goop', f.x, f.y);
}
