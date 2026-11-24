/**
 * BUILDER - V - Construction (instant, object)
 * Builds a random piece of furniture (chair, table or couch - looks only, they all
 * work the same) just in front of the Builder. It's solid cover: it blocks players
 * and enemy shots, and breaks once the enemy has done enough damage to it.
 * Hit it with the Sledge Hammer to fling it: it deals big damage to the enemy it hits.
 * Numbers: tuning.builder.furniture
 */
import type { AbilityDef, ObjectKindDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { spawnObject } from '../../objects.ts';
import { applyDamage } from '../../damage.ts';
import { applyHitstun } from '../../status.ts';
import { distanceTo } from '../../placeables.ts';
import { emitFx, emitSound } from '../../events.ts';
import { dist } from '../../math.ts';

/** The furniture types (each one is a sprite in config/assets.ts). */
export const FURNITURE = ['builder_furniture_chair', 'builder_furniture_table', 'builder_furniture_couch'];

export const construction: AbilityDef = {
  id: 'builder_construction',
  name: 'Construction',
  type: 'object',
  activation: 'instant',
  icon: 'icon_builder_construction',
  cooldown: (t) => t.builder.furniture.cooldown,

  update({ world, tuning, fighter: f, slot, pressed }) {
    if (!pressed || !isReady(f, slot)) return;
    const c = tuning.builder.furniture;
    const x = f.x + Math.cos(f.aimAngle) * c.spawnDistance;
    const y = f.y + Math.sin(f.aimAngle) * c.spawnDistance;
    // Needs a free spot: inside the arena, not on a player, structure or other object.
    const size = tuning.world.arenaSize;
    const blocked =
      x < c.size ||
      y < c.size ||
      x > size - c.size ||
      y > size - c.size ||
      world.fighters.some((o) => dist(x, y, o.x, o.y) < c.size + o.radius) ||
      world.placeables.some((p) => distanceTo(p, x, y) < c.size + p.radius) ||
      world.objects.some((o) => dist(x, y, o.x, o.y) < c.size + o.radius);
    if (blocked) {
      emitSound(world, 'fizzle', x, y);
      return;
    }
    // "Random" pick, worked out from the tick so every computer picks the same one.
    const kind = FURNITURE[(world.tick * 7 + f.id * 3) % FURNITURE.length];
    spawnObject(world, { ownerId: f.id, kind, x, y, vx: 0, vy: 0, radius: c.size, life: c.life, hp: c.hp, maxHp: c.hp });
    startCooldown(world, f, slot, c.cooldown);
    emitSound(world, 'furniture_build', x, y);
    emitFx(world, 'burst', x, y, '#c8a060', c.size * 1.5, 0.3);
  },
};

/** How furniture behaves as a physics object (one entry per furniture type). */
export const furnitureObjects: ObjectKindDef[] = FURNITURE.map((kind) => ({
  kind,
  solid: true,
  restitution: (t) => t.builder.furniture.restitution,
  // Barely slides when standing; flies far when flung.
  friction: (t, o) => (o.armed && Math.hypot(o.vx, o.vy) > t.builder.furniture.minFlingSpeed ? t.builder.furniture.flungFriction : t.builder.furniture.friction),
  onTouch(world, tuning, o, f) {
    if (!o.armed) return false;
    if (Math.hypot(o.vx, o.vy) < tuning.builder.furniture.minFlingSpeed) {
      o.armed = 0; // slowed down: harmless again
      return false;
    }
    if (f.id === o.ownerId) return false;
    applyDamage(world, f, tuning.builder.furniture.flingDamage, o.ownerId);
    applyHitstun(f, tuning.hitstun.furniture, tuning.world.tickRate);
    emitSound(world, 'furniture_hit', o.x, o.y);
    emitFx(world, 'burst', o.x, o.y, '#c8a060', o.radius * 2.5, 0.4);
    return true; // smashed to pieces on impact
  },
}));
