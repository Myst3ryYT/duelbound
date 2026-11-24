/**
 * REFRACTOR - C - Mirror (variable, dynamic placeable)
 * Press C to enter mirror mode. Hold the left mouse button where a mirror should
 * start, drag, and release where it should end (dragging past the maximum length
 * places it automatically). You stay in mirror mode to place more; press C again
 * (or right click) to go back to fighting. Mirrors can go anywhere in the arena.
 * Up to 3 mirrors at once (a 4th removes your oldest), and 3 stored uses.
 * Mirrors bounce every projectile; they only take damage from enemy shots.
 * Each mirror breaks by itself after life seconds (it flashes just before).
 * Numbers: tuning.refractor.mirror
 */
import type { AbilityDef } from '../../abilities.ts';
import { canPlaceSegment, removePlaceable, spawnPlaceable } from '../../placeables.ts';
import { dist } from '../../math.ts';
import { emitSound } from '../../events.ts';

export const mirror: AbilityDef = {
  id: 'refractor_mirror',
  name: 'Mirror',
  type: 'placeable',
  activation: 'variable',
  icon: 'icon_refractor_mirror',
  cooldown: (t) => t.refractor.mirror.chargeTime,
  charges: (t) => t.refractor.mirror.charges,
  stayPlacing: true,

  preview(world, tuning, f, x, y) {
    const m = tuning.refractor.mirror;
    if (!f.vars.placeDrag) {
      // Not dragging yet: a dot showing whether the start point is inside the arena.
      const size = tuning.world.arenaSize;
      return { sprite: '', x, y, angle: 0, radius: 6, valid: x >= 0 && y >= 0 && x <= size && y <= size };
    }
    const sx = f.vars.mirrorX;
    const sy = f.vars.mirrorY;
    const len = dist(sx, sy, x, y);
    const k = len > m.maxLength ? m.maxLength / len : 1;
    const ex = sx + (x - sx) * k;
    const ey = sy + (y - sy) * k;
    const valid = len >= m.minLength && canPlaceSegment(world, tuning, sx, sy, ex, ey, m.thickness / 2);
    return { sprite: 'refractor_mirror', x: sx, y: sy, x2: ex, y2: ey, angle: Math.atan2(ey - sy, ex - sx), radius: m.thickness / 2, valid };
  },

  placingUpdate({ world, tuning, fighter: f, input, pressed, released }) {
    const m = tuning.refractor.mirror;
    const ax = input.aimX;
    const ay = input.aimY;

    // First point: where the mouse button goes down.
    if (!f.vars.placeDrag) {
      if (!pressed) return null;
      const size = tuning.world.arenaSize;
      if (ax < 0 || ay < 0 || ax > size || ay > size) return null;
      f.vars.placeDrag = 1;
      f.vars.mirrorX = ax;
      f.vars.mirrorY = ay;
      return null;
    }

    // Dragging: place on release, or as soon as the drag reaches the max length.
    const sx = f.vars.mirrorX;
    const sy = f.vars.mirrorY;
    const len = dist(sx, sy, ax, ay);
    const tooLong = len >= m.maxLength;
    if (!released && !tooLong) return null;

    const k = tooLong ? m.maxLength / len : 1;
    const ex = sx + (ax - sx) * k;
    const ey = sy + (ay - sy) * k;
    f.vars.placeDrag = 0;
    if (len < m.minLength || !canPlaceSegment(world, tuning, sx, sy, ex, ey, m.thickness / 2)) {
      emitSound(world, 'fizzle', sx, sy);
      return null; // stay in placing mode and try again
    }

    // Too many mirrors? Remove this player's oldest.
    const mine = world.placeables.filter((p) => p.ownerId === f.id && p.kind === 'refractor_mirror');
    if (mine.length >= m.maxMirrors) removePlaceable(world, mine[0]);

    spawnPlaceable(world, {
      ownerId: f.id,
      kind: 'refractor_mirror',
      shape: 'segment',
      x: (sx + ex) / 2,
      y: (sy + ey) / 2,
      x1: sx,
      y1: sy,
      x2: ex,
      y2: ey,
      angle: Math.atan2(ey - sy, ex - sx),
      radius: m.thickness / 2,
      hp: m.hp,
      maxHp: m.hp,
      reflective: true,
      breakT: m.life,
    });
    emitSound(world, 'mirror_place', (sx + ex) / 2, (sy + ey) / 2);
    return 'placed';
  },
};
