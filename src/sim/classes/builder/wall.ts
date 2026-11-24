/**
 * BUILDER - C - Brick Wall (variable, placeable) - 2 charges
 * Placed exactly like the Refractor's mirrors: press C, drag out walls with the
 * left mouse button, press C again (or right click) to go back to fighting.
 * Lots of health. Blocks everyone's shots, yours too.
 * Smash it with your Sledge Hammer to fire its bricks at the enemy (see hammer.ts).
 * Numbers: tuning.builder.wall
 */
import { makeDragWall } from '../shared/dragWall.ts';

export const wall = makeDragWall({
  id: 'builder_wall',
  name: 'Brick Wall',
  icon: 'icon_builder_wall',
  reflective: false,
  blocksOwn: true,
  placeSound: 'wall_place',
  numbers: (t) => ({ ...t.builder.wall, maxActive: t.builder.wall.maxWalls }),
});
