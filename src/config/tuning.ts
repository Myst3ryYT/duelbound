/**
 * ============================================================================
 *  REBOUND - TUNING
 * ============================================================================
 *  Every gameplay number lives in this one file. Change a value, save, and the
 *  running game picks it up straight away (no restart needed).
 *
 *  Units:
 *    - distances are "world units" (the arena is 1080 x 1080 of them, the full screen height)
 *    - speeds are world units per second
 *    - times are seconds
 *
 *  FORMAT RULES (keep these so the dev panel's "Save" button can rewrite this file):
 *    - one value per line, like:      moveSpeed: 420, // what it does
 *    - a group opens with             name: {
 *      on its own line and closes with  },
 *    - only plain numbers (no maths like 2 * 3)
 * ============================================================================
 */
export const TUNING = {
  world: {
    arenaSize: 1080, // width and height of the square arena (1080 = top to bottom of the screen)
    tickRate: 60, // simulation steps per second (keep at 60 unless you know why)
  },

  player: {
    maxHp: 1000, // starting and maximum health of every character
    moveSpeed: 300, // top walking speed
    accelFrames: 0, // simulation frames to go from standing still to full speed (stopping is always instant)
    bodyRadius: 22, // size of the body for bumping into walls and other players
    projectileHitRadius: 26, // size of the body when checking if a projectile hits it
    placementCheckRadius: 40, // bigger safety circle used when placing structures near a player
    spawnDistance: 300, // how far from the arena centre each player starts (left and right)
  },

  projectiles: {
    hitboxScale: 1.2, // projectile hitboxes are this much bigger than how they look (1.2 = 20% bigger)
    maxLife: 6, // seconds before any projectile disappears on its own
  },

  training: {
    dummyHp: 1000, // health of the training dummy
    dummyRadius: 26, // body size of the training dummy
  },

  // ---------------------------------------------------------------- MAGE ----
  mage: {
    staff: {
      chargeTime: 0.8, // LC: seconds of holding to reach a full charge
      damageMin: 40, // LC: damage of an uncharged shot
      damageMax: 120, // LC: damage of a fully charged shot
      speedMin: 700, // LC: speed of an uncharged shot
      speedMax: 1300, // LC: speed of a fully charged shot
      sizeMin: 7, // LC: radius of an uncharged shot
      sizeMax: 13, // LC: radius of a fully charged shot
      fireInterval: 0.35, // LC: wait after a shot before you can start charging the next one
    },
    shield: {
      duration: 1.5, // RC: seconds the reflective shield stays up
      cooldown: 10, // RC: seconds before it can be used again (counts from when it goes up)
      radius: 46, // RC: size of the shield bubble
    },
    watchtower: {
      startup: 1.5, // C: seconds to build before it starts shooting
      hp: 200, // C: health of the tower
      life: 8, // C: seconds it keeps shooting once built
      fireInterval: 1.2, // C: seconds between each ring of 8 bolts
      boltDamage: 30, // C: damage of each bolt
      boltSpeed: 500, // C: speed of each bolt
      boltSize: 7, // C: radius of each bolt
      radius: 34, // C: size of the tower (for collisions and placement)
      cooldown: 18, // C: seconds before another tower can be placed (counts from placement)
    },
    switch: {
      turnTime: 0.4, // V: seconds a projectile takes to slow down and curve back the other way
      slowest: 0.15, // V: how slow a projectile gets mid-turn (0.15 = 15% of its speed)
      cooldown: 25, // V: seconds before Switch can be used again
    },
    teleport: {
      castTime: 0.35, // SPACE: seconds of animation before you arrive (you can't walk during it)
      cooldown: 8, // SPACE: seconds before teleport can be used again
    },
  },

  visuals: {
    damageNumberLife: 0.9, // seconds a floating damage number stays on screen
    damageNumberRise: 60, // how far a damage number floats upwards over its life
    hpTrailDelay: 0.5, // seconds before the white "recent damage" chunk of an HP bar starts shrinking
    hpTrailSpeed: 600, // how fast (HP per second) the white damage chunk shrinks
  },
};

/** The shape of the tuning object. Code uses this type so typos are caught. */
export type Tuning = typeof TUNING;
