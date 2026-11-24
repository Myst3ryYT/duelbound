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
  mage_watchtower: { file: 'mage_watchtower.png', size: 80 }, // the watchtower structure
  mage_shield: { file: 'mage_shield.png', size: 0 }, // one piece of the curved shield wall (stretched like the mirror; draw it lying flat)
  teleport_marker: { file: 'teleport_marker.png', size: 56 }, // where a teleport will land

  // ---- Sheriff ----
  class_sheriff: { file: 'sheriff.png', size: 64 }, // the Sheriff
  sheriff_bullet: { file: 'sheriff_bullet.png', size: 0 }, // revolver shot
  sheriff_lasso: { file: 'sheriff_lasso.png', size: 0 }, // lasso loop (the rope is drawn as a line)
  sheriff_bramble: { file: 'sheriff_bramble.png', size: 0 }, // tumbleweed (drawn at its hitbox size)
  sheriff_pierce: { file: 'sheriff_pierce.png', size: 0 }, // piercing bullet

  // ---- Refractor ----
  class_refractor: { file: 'refractor.png', size: 64 }, // the Refractor
  refractor_pellet: { file: 'refractor_pellet.png', size: 0 }, // shotgun pellet
  refractor_mirror: { file: 'refractor_mirror.png', size: 0 }, // mirror (stretched along its length; draw it lying flat, left to right)

  // ---- Builder ----
  class_builder: { file: 'builder.png', size: 64 }, // the Builder
  builder_nail: { file: 'builder_nail.png', size: 0 }, // nail gun shot
  builder_brick: { file: 'builder_brick.png', size: 0 }, // brick fired from a smashed wall
  builder_wall: { file: 'builder_wall.png', size: 0 }, // brick wall (stretched along its length; draw it lying flat, left to right)
  builder_furniture_chair: { file: 'builder_chair.png', size: 0 }, // furniture (drawn at its hitbox size)
  builder_furniture_table: { file: 'builder_table.png', size: 0 },
  builder_furniture_couch: { file: 'builder_couch.png', size: 0 },

  // ---- Training ----
  dummy_shot: { file: 'dummy_shot.png', size: 0 }, // what the dummy shoots

  // ---- Ability icons (HUD, screen pixels) ----
  icon_mage_staff: { file: 'icon_mage_staff.png', size: 64 },
  icon_mage_shield: { file: 'icon_mage_shield.png', size: 64 },
  icon_mage_watchtower: { file: 'icon_mage_watchtower.png', size: 64 },
  icon_mage_switch: { file: 'icon_mage_switch.png', size: 64 },
  icon_mage_teleport: { file: 'icon_mage_teleport.png', size: 64 },
  icon_sheriff_gun: { file: 'icon_sheriff_gun.png', size: 64 },
  icon_sheriff_lasso: { file: 'icon_sheriff_lasso.png', size: 64 },
  icon_sheriff_bramble: { file: 'icon_sheriff_bramble.png', size: 64 },
  icon_sheriff_pierce: { file: 'icon_sheriff_pierce.png', size: 64 },
  icon_sheriff_roll: { file: 'icon_sheriff_roll.png', size: 64 },
  icon_refractor_shotgun: { file: 'icon_refractor_shotgun.png', size: 64 },
  icon_refractor_ray: { file: 'icon_refractor_ray.png', size: 64 },
  icon_refractor_mirror: { file: 'icon_refractor_mirror.png', size: 64 },
  icon_refractor_dash: { file: 'icon_refractor_dash.png', size: 64 },
  icon_refractor_shatter: { file: 'icon_refractor_shatter.png', size: 64 },
  icon_builder_nailgun: { file: 'icon_builder_nailgun.png', size: 64 },
  icon_builder_hammer: { file: 'icon_builder_hammer.png', size: 64 },
  icon_builder_wall: { file: 'icon_builder_wall.png', size: 64 },
  icon_builder_construction: { file: 'icon_builder_construction.png', size: 64 },
  icon_builder_dash: { file: 'icon_builder_dash.png', size: 64 },
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
  switch: { file: 'switch.wav' }, // Mage V
  teleport_start: { file: 'teleport_start.wav' }, // Mage SPACE begins
  teleport: { file: 'teleport.wav' }, // Mage SPACE arrives
  bounce: { file: 'bounce.wav' }, // a shot bounced off a wall or structure
  gun_fire: { file: 'gun_fire.wav' }, // Sheriff LC
  lasso_throw: { file: 'lasso_throw.wav' }, // Sheriff RC thrown
  lasso_hit: { file: 'lasso_hit.wav' }, // Sheriff RC caught someone
  bramble_spawn: { file: 'bramble_spawn.wav' }, // Sheriff C
  bramble_hit: { file: 'bramble_hit.wav' }, // tumbleweed touched someone
  pierce_charge: { file: 'pierce_charge.wav' }, // Sheriff V aiming
  pierce_fire: { file: 'pierce_fire.wav' }, // Sheriff V fired
  roll: { file: 'roll.wav' }, // Sheriff SPACE
  dummy_fire: { file: 'dummy_fire.wav' }, // training dummy shoots
  reload_start: { file: 'reload_start.wav' }, // Sheriff revolver empty, reloading
  reload_done: { file: 'reload_done.wav' }, // Sheriff revolver reloaded
  shotgun_fire: { file: 'shotgun_fire.wav' }, // Refractor LC
  ray_start: { file: 'ray_start.wav' }, // Refractor RC beam starts
  mirror_place: { file: 'mirror_place.wav' }, // Refractor C placed
  mirror_bounce: { file: 'mirror_bounce.wav' }, // a shot bounced off a mirror
  mirror_split: { file: 'mirror_split.wav' }, // a pellet doubled off a mirror
  mirror_break: { file: 'mirror_break.wav' }, // a mirror broke
  dash: { file: 'dash.wav' }, // Refractor / Builder SPACE
  shatter: { file: 'shatter.wav' }, // Refractor V
  nail_fire: { file: 'nail_fire.wav' }, // Builder LC
  hammer_swing: { file: 'hammer_swing.wav' }, // Builder RC, hit nothing
  hammer_hit: { file: 'hammer_hit.wav' }, // Builder RC, hit something
  wall_place: { file: 'wall_place.wav' }, // Builder C placed
  wall_break: { file: 'wall_break.wav' }, // Builder smashed their wall into bricks
  furniture_build: { file: 'furniture_build.wav' }, // Builder V
  furniture_hit: { file: 'furniture_hit.wav' }, // flung furniture hit someone
};

export type SpriteId = keyof typeof SPRITES;
export type SoundId = keyof typeof SOUNDS;
