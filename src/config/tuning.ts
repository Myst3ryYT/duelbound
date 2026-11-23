/**
 * ============================================================================
 *  REBOUND - TUNING
 * ============================================================================
 *  Every gameplay number lives in this one file. Change a value, save, and the
 *  running game picks it up straight away (no restart needed).
 *
 *  Units:
 *    - distances are "world units" (the arena is 960 x 960 of them)
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
    arenaSize: 960, // width and height of the square arena, in world units
    tickRate: 60, // simulation steps per second (keep at 60 unless you know why)
  },

  player: {
    maxHp: 1000, // starting and maximum health of every character
    moveSpeed: 420, // top walking speed
    accelFrames: 3, // simulation frames to go from standing still to full speed (stopping is always instant)
    bodyRadius: 22, // size of the body for bumping into walls and other players
    projectileHitRadius: 26, // size of the body when checking if a projectile hits it
    placementCheckRadius: 40, // bigger safety circle used when placing structures near a player
    spawnDistance: 300, // how far from the arena centre each player starts (left and right)
  },

  training: {
    dummyHp: 1000, // health of the training dummy
    dummyRadius: 26, // body size of the training dummy
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
