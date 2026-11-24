/**
 * REFRACTOR - C - Mirror (variable, dynamic placeable)
 * Press C to enter mirror mode, then drag out mirrors with the left mouse button
 * (the placing itself is shared with the Builder's wall: see ../shared/dragWall.ts).
 * Press C again (or right click) to go back to fighting.
 * Up to 3 mirrors at once (a 4th removes your oldest), and 3 stored uses.
 * Mirrors bounce every projectile; they only take damage from enemy shots.
 * Each mirror breaks by itself after life seconds (it flashes just before).
 * Numbers: tuning.refractor.mirror
 */
import { makeDragWall } from '../shared/dragWall.ts';

export const mirror = makeDragWall({
  id: 'refractor_mirror',
  name: 'Mirror',
  icon: 'icon_refractor_mirror',
  reflective: true,
  placeSound: 'mirror_place',
  numbers: (t) => ({ ...t.refractor.mirror, maxActive: t.refractor.mirror.maxMirrors }),
});
