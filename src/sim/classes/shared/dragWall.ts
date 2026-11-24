/**
 * A line-shaped structure placed by dragging (Refractor mirrors, Builder brick walls).
 *
 * Press the key to enter placing mode. Hold the left mouse button where it should
 * start, drag, and release where it should end (dragging past the maximum length
 * places it automatically). You stay in placing mode to place more; press the key
 * again (or right click) to go back to fighting. It can go anywhere in the arena.
 * Each class gives its own numbers (see the WallNumbers fields below).
 */
import type { Tuning } from '../../../config/tuning.ts';
import type { AbilityDef } from '../../abilities.ts';
import { canPlaceSegment, removePlaceable, spawnPlaceable } from '../../placeables.ts';
import { dist } from '../../math.ts';
import { emitSound } from '../../events.ts';

export interface WallNumbers {
  maxActive: number; // how many can stand at once (placing another removes your oldest)
  charges: number; // uses stored up
  chargeTime: number; // seconds for one use to come back
  maxLength: number; // longest it can be
  minLength: number; // shorter drags are ignored
  hp: number;
  life: number; // seconds before it breaks by itself
  thickness: number;
}

export interface DragWallOptions {
  id: string; // ability id, also used as the structure's kind and sprite
  name: string;
  icon: string;
  reflective: boolean; // bounces shots (mirror) or blocks them (wall)
  placeSound: string;
  numbers: (t: Tuning) => WallNumbers;
}

export function makeDragWall(o: DragWallOptions): AbilityDef {
  return {
    id: o.id,
    name: o.name,
    type: 'placeable',
    activation: 'variable',
    icon: o.icon,
    cooldown: (t) => o.numbers(t).chargeTime,
    charges: (t) => o.numbers(t).charges,
    stayPlacing: true,

    preview(world, tuning, f, x, y) {
      const m = o.numbers(tuning);
      if (!f.vars.placeDrag) {
        // Not dragging yet: a dot showing whether the start point is inside the arena.
        const size = tuning.world.arenaSize;
        return { sprite: '', x, y, angle: 0, radius: 6, valid: x >= 0 && y >= 0 && x <= size && y <= size };
      }
      const sx = f.vars.dragX;
      const sy = f.vars.dragY;
      const len = dist(sx, sy, x, y);
      const k = len > m.maxLength ? m.maxLength / len : 1;
      const ex = sx + (x - sx) * k;
      const ey = sy + (y - sy) * k;
      const valid = len >= m.minLength && canPlaceSegment(world, tuning, sx, sy, ex, ey, m.thickness / 2);
      return { sprite: o.id, x: sx, y: sy, x2: ex, y2: ey, angle: Math.atan2(ey - sy, ex - sx), radius: m.thickness / 2, valid };
    },

    placingUpdate({ world, tuning, fighter: f, input, pressed, released }) {
      const m = o.numbers(tuning);
      const ax = input.aimX;
      const ay = input.aimY;

      // First point: where the mouse button goes down.
      if (!f.vars.placeDrag) {
        if (!pressed) return null;
        const size = tuning.world.arenaSize;
        if (ax < 0 || ay < 0 || ax > size || ay > size) return null;
        f.vars.placeDrag = 1;
        f.vars.dragX = ax;
        f.vars.dragY = ay;
        return null;
      }

      // Dragging: place on release, or as soon as the drag reaches the max length.
      const sx = f.vars.dragX;
      const sy = f.vars.dragY;
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

      // Too many? Remove this player's oldest.
      const mine = world.placeables.filter((p) => p.ownerId === f.id && p.kind === o.id);
      if (mine.length >= m.maxActive) removePlaceable(world, mine[0]);

      spawnPlaceable(world, {
        ownerId: f.id,
        kind: o.id,
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
        reflective: o.reflective,
        breakT: m.life,
      });
      emitSound(world, o.placeSound, (sx + ex) / 2, (sy + ey) / 2);
      return 'placed';
    },
  };
}
