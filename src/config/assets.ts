/**
 * ============================================================================
 *  REBOUND - ASSET MAP (art and sounds)
 * ============================================================================
 *  Every sprite and sound in the game is listed here by name.
 *
 *  TO USE YOUR OWN ART:
 *    Put a PNG with the listed file name into the  public/art/  folder.
 *    The game uses it automatically. If the file is missing, it falls back to
 *    the placeholder drawn in code (src/render/placeholders.ts).
 *    Sprites that rotate should face to the RIGHT in your image.
 *
 *  TO USE YOUR OWN SOUNDS:
 *    Put a .wav / .mp3 / .ogg with the listed file name into  public/sfx/ .
 *    Missing files fall back to a simple generated beep.
 *
 *  "size" is how big the sprite is drawn in the game world (world units),
 *  whatever the resolution of your image.
 * ============================================================================
 */

export const SPRITES = {
  fighter_default: { file: 'fighter_default.png', size: 60 }, // a player before classes are picked
  dummy: { file: 'dummy.png', size: 64 }, // training dummy
  floor_tile: { file: 'floor_tile.png', size: 64 }, // repeated across the arena floor
  wall_tile: { file: 'wall_tile.png', size: 16 }, // repeated along the arena border
  crosshair: { file: 'crosshair.png', size: 36 }, // replaces the mouse cursor (size in screen pixels)
};

export const SOUNDS = {
  hit: { file: 'hit.wav' }, // something took damage
  reset: { file: 'reset.wav' }, // training dummy HP reset
  ui_click: { file: 'ui_click.wav' }, // menu button pressed
};

export type SpriteId = keyof typeof SPRITES;
export type SoundId = keyof typeof SOUNDS;
