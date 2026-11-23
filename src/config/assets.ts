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
 *  "size" is how big the sprite is drawn (world units; screen pixels for HUD icons),
 *  whatever the resolution of your image. Projectiles and shields ignore "size":
 *  they are drawn to match their hitbox, which is set in tuning.ts.
 * ============================================================================
 */

export const SPRITES = {
  // ---- Arena ----
  floor_tile: { file: 'floor_tile.png', size: 64 }, // repeated across the arena floor
  wall_tile: { file: 'wall_tile.png', size: 16 }, // repeated along the arena border
  crosshair: { file: 'crosshair.png', size: 36 }, // replaces the mouse cursor (screen pixels)

  // ---- Characters ----
  fighter_default: { file: 'fighter_default.png', size: 60 }, // a player with no class
  dummy: { file: 'dummy.png', size: 64 }, // training dummy
  class_mage: { file: 'mage.png', size: 64 }, // the Mage

  // ---- Mage ----
  mage_bolt: { file: 'mage_bolt.png', size: 0 }, // staff shot
  mage_tower_bolt: { file: 'mage_tower_bolt.png', size: 0 }, // watchtower shot
  mage_watchtower: { file: 'mage_watchtower.png', size: 80 }, // the watchtower structure
  mage_shield: { file: 'mage_shield.png', size: 0 }, // reflective shield bubble
  teleport_marker: { file: 'teleport_marker.png', size: 56 }, // where a teleport will land

  // ---- Ability icons (HUD, screen pixels) ----
  icon_mage_staff: { file: 'icon_mage_staff.png', size: 64 },
  icon_mage_shield: { file: 'icon_mage_shield.png', size: 64 },
  icon_mage_watchtower: { file: 'icon_mage_watchtower.png', size: 64 },
  icon_mage_switch: { file: 'icon_mage_switch.png', size: 64 },
  icon_mage_teleport: { file: 'icon_mage_teleport.png', size: 64 },
};

export const SOUNDS = {
  hit: { file: 'hit.wav' }, // something took damage
  reset: { file: 'reset.wav' }, // training dummy HP reset
  ui_click: { file: 'ui_click.wav' }, // menu button pressed
  structure_destroyed: { file: 'structure_destroyed.wav' }, // a placeable was shot down
  fizzle: { file: 'fizzle.wav' }, // an ability failed (e.g. teleport spot got blocked)
  reflect: { file: 'reflect.wav' }, // a projectile bounced off a shield
  staff_fire: { file: 'staff_fire.wav' }, // Mage LC
  shield_up: { file: 'shield_up.wav' }, // Mage RC
  tower_build: { file: 'tower_build.wav' }, // Mage C placed
  tower_fire: { file: 'tower_fire.wav' }, // watchtower shoots
  switch: { file: 'switch.wav' }, // Mage V
  teleport_start: { file: 'teleport_start.wav' }, // Mage SPACE begins
  teleport: { file: 'teleport.wav' }, // Mage SPACE arrives
};

export type SpriteId = keyof typeof SPRITES;
export type SoundId = keyof typeof SOUNDS;
