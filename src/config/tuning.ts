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
    dummyFireInterval: 1, // seconds between dummy shots (when dummy shooting is switched on)
    dummyShotDamage: 30, // damage of each dummy shot
    dummyShotSpeed: 600, // speed of each dummy shot
    dummyShotSize: 9, // radius of each dummy shot
  },

  // ---------------------------------------------------------------- MAGE ----
  mage: {
    staff: {
      chargeTime: 1.3, // LC: seconds of holding to reach a full charge
      damageMin: 20, // LC: damage of an uncharged shot
      damageMax: 90, // LC: damage of a fully charged shot
      speedMin: 400, // LC: speed of an uncharged shot
      speedMax: 1300, // LC: speed of a fully charged shot
      sizeMin: 7, // LC: radius of an uncharged shot
      sizeMax: 20, // LC: radius of a fully charged shot
      fireInterval: 0.35, // LC: wait after a shot before you can start charging the next one
    },
    shield: {
      duration: 2, // RC: seconds the reflective shield stays up
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
      boltSize: 10, // C: radius of each bolt
      radius: 34, // C: size of the tower (for collisions and placement)
      cooldown: 18, // C: seconds before another tower can be placed (counts from placement)
    },
    switch: {
      turnTime: 1, // V: seconds a projectile takes to slow to a stop and fly back at full speed
      cooldown: 0, // V: seconds before Switch can be used again
    },
    teleport: {
      castTime: 0.35, // SPACE: seconds of animation before you arrive (you can't walk during it)
      cooldown: 8, // SPACE: seconds before teleport can be used again
    },
  },

  // ------------------------------------------------------------- SHERIFF ----
  sheriff: {
    gun: {
      fireInterval: 0.6, // LC: seconds between shots (hold to keep firing)
      speed: 1100, // LC: bullet speed
      damageNear: 70, // LC: damage at point blank
      damageFar: 30, // LC: damage at long range
      falloffRange: 700, // LC: distance travelled at which damage has dropped to damageFar
      size: 10.5, // LC: bullet radius
      ammo: 6, // LC: shots before the Sheriff has to reload
      reloadTime: 1.5, // LC: seconds to reload (starts by itself when the gun is empty)
    },
    lasso: {
      range: 800, // RC: how far the lasso flies
      speed: 800, // RC: how fast the lasso flies
      damage: 20, // RC: damage when it catches someone
      pullSpeed: 1000, // RC: how fast the caught player is dragged to the Sheriff
      size: 9, // RC: radius of the lasso loop
      cooldown: 9, // RC: seconds before it can be thrown again
    },
    bramble: {
      spawnDistance: 80, // C: how far from the Sheriff the tumbleweed appears (towards the crosshair)
      tossSpeed: 150, // C: speed it starts rolling at, towards the crosshair
      life: 8, // C: seconds before it crumbles on its own
      damage: 30, // C: damage to whoever it touches (the Sheriff too)
      stun: 1.3, // C: seconds the touched player can't move or use abilities
      restitution: 0.9, // C: bounciness off walls and structures (1 = no speed lost)
      shotImpulse: 350, // C: how much speed a projectile hit adds to it
      friction: 0.6, // C: how quickly it slows down by itself (0 = rolls forever)
      size: 33, // C: radius of the tumbleweed
      carry: 0.75, // C: a stunned player is dragged along at this share of the tumbleweed's speed (1 = same speed)
      carryDrag: 1.5, // C: extra slowdown on the tumbleweed while it drags someone
      rehitDelay: 1.5, // C: seconds before the same tumbleweed can stun the same player again
      cooldown: 10, // C: seconds before another can be summoned
    },
    pierce: {
      delay: 0.4, // V: seconds of aiming before the shot goes off
      speed: 12339, // V: bullet speed
      bounces: 3, // V: how many walls / structures it bounces off
      damage: 140, // V: damage on hit
      trail: 1.6, // V: seconds the bullet trail stays visible (looks only)
      size: 5, // V: bullet radius
      previewLength: 2500, // V: how far the predicted path is drawn while aiming
      cooldown: 10, // V: seconds before it can be used again
    },
    roll: {
      duration: 0.35, // SPACE: seconds the roll lasts
      invincible: 0.2, // SPACE: seconds of invincibility at the start of the roll
      distance: 300, // SPACE: how far the roll goes
      cooldown: 4, // SPACE: seconds before rolling again
    },
  },

  // ----------------------------------------------------------- REFRACTOR ----
  refractor: {
    shotgun: {
      pellets: 4, // LC: pellets per shot
      spread: 6, // LC: total spread of the pellets, in degrees
      damage: 18, // LC: damage per pellet
      speed: 1000, // LC: pellet speed
      size: 5, // LC: pellet radius
      fireInterval: 0.5, // LC: seconds between shots
      splitAngle: 5, // LC: degrees between the two halves when a pellet doubles off your mirror
      mirrorBreakDelay: 0.15, // LC: seconds after doubling a volley before that mirror breaks
    },
    ray: {
      pool: 100, // RC: size of the resource pool (bar next to the crosshair)
      drain: 40, // RC: pool used per second while firing
      refill: 25, // RC: pool regained per second when not firing
      refillDelay: 1, // RC: seconds of not firing before the pool starts refilling
      dps: 40, // RC: damage per second (doubles for every mirror the beam bounces off)
      maxReflections: 3, // RC: how many mirrors the beam can bounce off
      tickInterval: 0.1, // RC: seconds between damage ticks
      range: 2500, // RC: total beam length, including bounces
      width: 6, // RC: beam thickness (grows with each mirror; looks only)
    },
    mirror: {
      maxMirrors: 3, // C: mirrors you can have at once (placing another removes your oldest)
      charges: 3, // C: uses stored up
      chargeTime: 6, // C: seconds for one use to come back
      maxLength: 220, // C: longest mirror (dragging further places it automatically)
      minLength: 40, // C: shortest mirror (shorter drags are ignored)
      hp: 150, // C: mirror health
      thickness: 10, // C: mirror thickness (for collisions)
    },
    refract: {
      duration: 0.6, // V: seconds you stay split
      separation: 90, // V: distance between the two halves
      cooldown: 8, // V: seconds before it can be used again
    },
    shatter: {
      radius: 250, // SPACE: distance from a mirror that gets hurt
      damage: 40, // SPACE: damage per mirror (near 2 mirrors = hit twice)
      cooldown: 20, // SPACE: seconds before it can be used again
    },
  },

  visuals: {
    damageNumberLife: 0.9, // seconds a floating damage number stays on screen
    damageNumberRise: 60, // how far a damage number floats upwards over its life
    damageNumberMerge: 0.35, // hits on the same target this close together (seconds) add up into one number
    hpTrailDelay: 0.5, // seconds before the white "recent damage" chunk of an HP bar starts shrinking
    hpTrailSpeed: 600, // how fast (HP per second) the white damage chunk shrinks
  },
};

/** The shape of the tuning object. Code uses this type so typos are caught. */
export type Tuning = typeof TUNING;
