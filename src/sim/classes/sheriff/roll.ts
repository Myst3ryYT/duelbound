/**
 * SHERIFF - SPACE - Roll (instant, misc)
 * A quick roll in the direction you're walking (or towards the crosshair if
 * standing still). Projectiles and objects pass through you at the start of it.
 * Numbers: tuning.sheriff.roll
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { emitSound } from '../../events.ts';

export const roll: AbilityDef = {
  id: 'sheriff_roll',
  name: 'Roll',
  type: 'misc',
  activation: 'instant',
  icon: 'icon_sheriff_roll',
  cooldown: (t) => t.sheriff.roll.cooldown,

  update({ world, tuning, fighter: f, input, slot, pressed, dt }) {
    const r = tuning.sheriff.roll;

    // Rolling: move along the roll direction (walls and structures still stop you).
    if (f.vars.rollT > 0) {
      const speed = r.distance / Math.max(0.001, r.duration);
      const step = Math.min(dt, f.vars.rollT);
      f.x += f.vars.rollDX * speed * step;
      f.y += f.vars.rollDY * speed * step;
      f.vars.rollT -= dt;
      return;
    }

    if (!pressed || !isReady(f, slot) || f.stunT > 0 || f.hitstunT > 0 || f.pullById || f.vars.mountT > 0) return;
    let dx = input.moveX;
    let dy = input.moveY;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
      dx = Math.cos(f.aimAngle);
      dy = Math.sin(f.aimAngle);
    }
    const len = Math.hypot(dx, dy);
    f.vars.rollDX = dx / len;
    f.vars.rollDY = dy / len;
    f.vars.rollT = r.duration;
    f.rootedT = r.duration; // normal walking is off during the roll
    f.invulnT = r.invincible;
    startCooldown(world, f, slot, r.cooldown);
    emitSound(world, 'roll', f.x, f.y);
  },
};
