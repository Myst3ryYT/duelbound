/**
 * The kick (F): every class has it. A short, wide shove in front of you.
 * It does a little damage and a solid knockback (about like the Builder's hammer used to),
 * so rushing in and trading hits isn't free: the other player can kick you back out.
 * Numbers: tuning.kick
 */
import type { Tuning } from '../config/tuning.ts';
import type { Fighter, PlayerInput, World } from './types.ts';
import { applyDamage } from './damage.ts';
import { applyHitstun, applyKnockback } from './status.ts';
import { emitFx, emitSound } from './events.ts';
import { dist } from './math.ts';

export function runKick(world: World, tuning: Tuning, f: Fighter, input: PlayerInput): void {
  const k = tuning.kick;
  const pressed = input.buttons.kick && !f.prevButtons.kick;
  if (!pressed || f.kickCd > 0 || f.stunT > 0 || f.hitstunT > 0 || f.pullById) return;
  f.kickCd = k.cooldown;

  let hit = false;
  for (const target of world.fighters) {
    if (target.id === f.id || target.invulnT > 0) continue;
    const d = dist(f.x, f.y, target.x, target.y);
    if (d > f.radius + k.range + target.radius) continue;
    // Is the target inside the kick's arc? (Right on top of us always counts.)
    let diff = Math.atan2(target.y - f.y, target.x - f.x) - f.aimAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (d > f.radius + target.radius && Math.abs(diff) > (k.arcDegrees * Math.PI) / 360) continue;
    applyDamage(world, target, k.damage, f.id);
    applyHitstun(target, tuning.hitstun.kick, tuning.world.tickRate);
    applyKnockback(target, Math.atan2(target.y - f.y, target.x - f.x), k.knockback);
    hit = true;
  }
  emitFx(world, 'burst', f.x + Math.cos(f.aimAngle) * (f.radius + 20), f.y + Math.sin(f.aimAngle) * (f.radius + 20), '#ffffff', 22, 0.15);
  emitSound(world, hit ? 'hammer_hit' : 'hammer_swing', f.x, f.y);
}
