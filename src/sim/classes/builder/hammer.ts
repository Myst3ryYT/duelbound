/**
 * BUILDER - RC - Sledge Hammer (instant, melee)
 * A big swing in front of the Builder. Everything in the swing:
 *  - enemy players take damage
 *  - your own brick walls break instantly and fire their bricks towards your crosshair
 *  - your own furniture gets flung the way you're facing (it hurts the enemy it hits)
 *  - enemy structures and furniture take heavy damage
 * Numbers: tuning.builder.hammer (bricks: tuning.builder.wall)
 */
import type { Tuning } from '../../../config/tuning.ts';
import type { AbilityDef } from '../../abilities.ts';
import type { Fighter, Placeable, World } from '../../types.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { applyDamage } from '../../damage.ts';
import { closestPoint, damagePlaceable, removePlaceable } from '../../placeables.ts';
import { damageObject } from '../../objects.ts';
import { spawnProjectile } from '../../projectiles.ts';
import { emitFx, emitSound } from '../../events.ts';
import { dist } from '../../math.ts';

export const hammer: AbilityDef = {
  id: 'builder_hammer',
  name: 'Sledge Hammer',
  type: 'misc',
  activation: 'instant',
  icon: 'icon_builder_hammer',
  cooldown: (t) => t.builder.hammer.cooldown,

  update({ world, tuning, fighter: f, slot, pressed, dt }) {
    if (f.vars.swingT > 0) f.vars.swingT = Math.max(0, f.vars.swingT - dt); // swing animation
    if (!pressed || !isReady(f, slot)) return;
    const h = tuning.builder.hammer;
    f.vars.swingT = h.swingTime;
    f.vars.swingAngle = f.aimAngle;

    /** Is the point (x, y), with some extra size, inside the swing? */
    const inSwing = (x: number, y: number, size: number) => {
      const d = dist(f.x, f.y, x, y);
      if (d > f.radius + h.range + size) return false;
      if (d < f.radius + size) return true; // right on top of us
      let diff = Math.atan2(y - f.y, x - f.x) - f.aimAngle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      return Math.abs(diff) <= (h.arcDegrees * Math.PI) / 360;
    };

    let hitSomething = false;
    for (const target of world.fighters) {
      if (target.id === f.id || target.invulnT > 0 || !inSwing(target.x, target.y, target.radius)) continue;
      applyDamage(world, target, h.damage, f.id);
      hitSomething = true;
    }
    for (const p of [...world.placeables]) {
      const c = closestPoint(p, f.x, f.y);
      if (!inSwing(c.x, c.y, p.radius)) continue;
      hitSomething = true;
      if (p.ownerId === f.id && p.kind === 'builder_wall') breakWall(world, tuning, f, p);
      else if (p.ownerId !== f.id) damagePlaceable(world, p, h.structureDamage);
    }
    for (const o of world.objects) {
      if (!inSwing(o.x, o.y, o.radius)) continue;
      hitSomething = true;
      if (o.ownerId === f.id && o.kind.startsWith('builder_furniture')) {
        // Fling it!
        o.vx = Math.cos(f.aimAngle) * h.flingSpeed;
        o.vy = Math.sin(f.aimAngle) * h.flingSpeed;
        o.armed = 1;
      } else if (o.ownerId !== f.id) damageObject(world, o, h.structureDamage);
    }

    startCooldown(world, f, slot, h.cooldown);
    emitSound(world, hitSomething ? 'hammer_hit' : 'hammer_swing', f.x, f.y);
  },
};

/** Smash one of your own walls: it's gone, and its bricks fly the way you're facing. */
function breakWall(world: World, tuning: Tuning, f: Fighter, p: Placeable): void {
  const w = tuning.builder.wall;
  const count = Math.max(1, Math.round(w.bricks));
  for (let i = 0; i < count; i++) {
    const k = count === 1 ? 0.5 : i / (count - 1); // spread the bricks along the wall
    const spread = (k - 0.5) * ((w.brickSpread * Math.PI) / 180);
    const x = p.x1 + (p.x2 - p.x1) * k;
    const y = p.y1 + (p.y2 - p.y1) * k;
    // Every brick flies towards the crosshair (so they bunch up on what you're aiming at).
    const aim = Math.hypot(f.aimX - x, f.aimY - y) > 60 ? Math.atan2(f.aimY - y, f.aimX - x) : f.aimAngle;
    spawnProjectile(world, tuning, {
      ownerId: f.id,
      kind: 'builder_brick',
      x,
      y,
      angle: aim + spread,
      speed: w.brickSpeed,
      radius: w.brickSize,
      damage: w.brickDamage,
    });
  }
  removePlaceable(world, p);
  emitFx(world, 'burst', p.x, p.y, '#c0583a', 50, 0.35);
  emitSound(world, 'wall_break', p.x, p.y);
}
