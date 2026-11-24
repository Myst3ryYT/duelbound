/**
 * FROG - LC - Tongue (instant, melee)
 * The tongue lashes out like a whip towards the crosshair. An enemy it touches
 * takes damage and is shoved away hard. Tumbleweeds get knocked away, enemy
 * furniture takes damage.
 * Numbers: tuning.frog.tongue
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { applyDamage } from '../../damage.ts';
import { applyHitstun, applyKnockback } from '../../status.ts';
import { damageObject } from '../../objects.ts';
import { emitSound } from '../../events.ts';
import { distToSegment } from '../../math.ts';

export const tongue: AbilityDef = {
  id: 'frog_tongue',
  name: 'Tongue',
  type: 'misc',
  activation: 'instant',
  icon: 'icon_frog_tongue',
  cooldown: (t) => t.frog.tongue.cooldown,

  update({ world, tuning, fighter: f, slot, pressed, dt }) {
    if (f.vars.tongueT > 0) f.vars.tongueT = Math.max(0, f.vars.tongueT - dt); // drawing only
    if (!pressed || !isReady(f, slot) || f.vars.airT > 0) return;
    const k = tuning.frog.tongue;
    f.vars.tongueT = k.time;
    f.vars.tongueAngle = f.aimAngle;

    // The tongue is a line from the Frog's mouth to its tip.
    const reach = f.radius + k.range;
    const tipX = f.x + Math.cos(f.aimAngle) * reach;
    const tipY = f.y + Math.sin(f.aimAngle) * reach;
    let hit = false;
    for (const target of world.fighters) {
      if (target.id === f.id || target.invulnT > 0) continue;
      if (distToSegment(target.x, target.y, f.x, f.y, tipX, tipY) > target.radius + k.width) continue;
      applyDamage(world, target, k.damage, f.id);
      applyHitstun(target, tuning.hitstun.tongue, tuning.world.tickRate);
      applyKnockback(target, Math.atan2(target.y - f.y, target.x - f.x), k.knockback);
      hit = true;
    }
    for (const o of world.objects) {
      if (distToSegment(o.x, o.y, f.x, f.y, tipX, tipY) > o.radius + k.width) continue;
      if (o.maxHp <= 0) {
        o.vx = Math.cos(f.aimAngle) * k.objectFling; // a tumbleweed: knock it away
        o.vy = Math.sin(f.aimAngle) * k.objectFling;
      } else if (o.ownerId !== f.id) damageObject(world, o, k.damage);
    }

    startCooldown(world, f, slot, k.cooldown);
    emitSound(world, hit ? 'frog_tongue_hit' : 'frog_tongue', f.x, f.y);
  },
};
