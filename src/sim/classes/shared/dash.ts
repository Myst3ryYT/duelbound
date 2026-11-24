/**
 * A plain dash, shared by several classes (Refractor and Builder use it on SPACE).
 * A quick burst in the direction you're walking (or towards the crosshair if
 * standing still). Walls and structures still stop you. No invincibility.
 * Each class has its own numbers in tuning.ts (e.g. tuning.refractor.dash).
 */
import type { Tuning } from '../../../config/tuning.ts';
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { emitSound } from '../../events.ts';

export interface DashNumbers {
  distance: number;
  duration: number;
  cooldown: number;
}

export function makeDash(id: string, icon: string, numbers: (t: Tuning) => DashNumbers): AbilityDef {
  return {
    id,
    name: 'Dash',
    type: 'misc',
    activation: 'instant',
    icon,
    cooldown: (t) => numbers(t).cooldown,

    update({ world, tuning, fighter: f, input, slot, pressed, dt }) {
      const d = numbers(tuning);

      // Dashing: move along the dash direction.
      if (f.vars.dashT > 0) {
        const speed = d.distance / Math.max(0.001, d.duration);
        const step = Math.min(dt, f.vars.dashT);
        f.x += f.vars.dashDX * speed * step;
        f.y += f.vars.dashDY * speed * step;
        f.vars.dashT -= dt;
        return;
      }

      if (!pressed || !isReady(f, slot) || f.stunT > 0 || f.hitstunT > 0 || f.pullById) return;
      let dx = input.moveX;
      let dy = input.moveY;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
        dx = Math.cos(f.aimAngle);
        dy = Math.sin(f.aimAngle);
      }
      const len = Math.hypot(dx, dy);
      f.vars.dashDX = dx / len;
      f.vars.dashDY = dy / len;
      f.vars.dashT = d.duration;
      f.rootedT = d.duration; // normal walking is off during the dash
      startCooldown(world, f, slot, d.cooldown);
      emitSound(world, 'dash', f.x, f.y);
    },
  };
}
