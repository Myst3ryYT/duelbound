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
    maxHp: 500, // starting and maximum health of every character
    knockFriction: 7, // how quickly a knockback shove slows down (higher = shorter shove; distance is about speed / this)
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

  // Hitstun: a short freeze (no moving, no abilities) for whoever takes a big hit. In frames (60 per second).
  hitstun: {
    hammer: 6, // Builder RC: sledge hammer hit
    kick: 3, // F: kick hit
    gun: 2, // Sheriff LC: revolver hit (tiny, shots come fast)
    furniture: 8, // Builder V: flung furniture hit
    trample: 6, // Sheriff V: horse trample hit
    shatter: 5, // Refractor V: shatter hit
  },

  // The kick (F), the same for every class.
  kick: {
    damage: 25, // damage to an enemy player hit by the kick
    knockback: 1400, // how hard they're shoved away (starting speed; see player.knockFriction for how far that goes)
    range: 45, // reach of the kick, from the edge of your body
    arcDegrees: 100, // how wide the kick is (degrees)
    cooldown: 1.2, // seconds between kicks
  },

  training: {
    dummyHp: 500, // health of the training dummy
    dummyRadius: 26, // body size of the training dummy
    dummyFireInterval: 1, // seconds between dummy shots (when dummy shooting is switched on)
    dummyShotDamage: 30, // damage of each dummy shot
    dummyShotSpeed: 600, // speed of each dummy shot
    dummyShotSize: 9, // radius of each dummy shot
  },

  match: {
    countdown: 3, // seconds of "3, 2, 1" before each round (nobody can move)
    roundTime: 90, // seconds on the round clock (when it runs out, more HP wins)
    roundsToWin: 2, // rounds needed to win the match (2 = best of 3)
    resultTime: 2.5, // seconds the round result is shown before the next countdown
    tieTime: 2.5, // seconds the tie screen is shown before the round is replayed
  },

  net: {
    snapshotEvery: 2, // online: the host sends the world every this many ticks (2 = 30 times a second)
    interpDelay: 0.08, // online: the guest draws the opponent's side this many seconds in the past, for smooth motion
    reconnectWait: 10, // online: seconds to wait for a dropped player to come back before the other one wins
    maxQueuedInputs: 3, // online: if more guest inputs than this pile up at the host, the oldest are merged so the guest isn't stuck in the past
  },

  bot: {
    normal: {
      reactionTime: 0.35, // seconds after a shot is fired before the bot notices it
      aimJitter: 70, // random aim error, in world units (0 = perfect aim)
      leadFactor: 0.5, // how well it predicts where you're moving (1 = perfectly, 0 = shoots where you are)
      dodgeChance: 0.25, // chance it tries to dodge each shot it notices (0..1)
      defendChance: 0.2, // chance it uses a defensive ability (shield, roll, dash...) against a close shot
      abilityRate: 0.4, // how often per second it considers using a cooldown ability
      moveSpeed: 0.6, // share of full walking speed it uses (dodging always uses full speed)
      pauseChance: 0.35, // chance it stands still instead of strafing, each time it changes direction
    },
    hard: {
      reactionTime: 0.1, // seconds after a shot is fired before the bot notices it
      aimJitter: 35, // random aim error, in world units (0 = perfect aim)
      leadFactor: 0.8, // how well it predicts where you're moving (1 = perfectly, 0 = shoots where you are)
      dodgeChance: 0.55, // chance it tries to dodge each shot it notices (0..1)
      defendChance: 0.5, // chance it uses a defensive ability (shield, roll, dash...) against a close shot
      abilityRate: 0.7, // how often per second it considers using a cooldown ability
      moveSpeed: 1, // share of full walking speed it uses (dodging always uses full speed)
      pauseChance: 0, // chance it stands still instead of strafing, each time it changes direction
    },
    strafeMin: 0.8, // both difficulties: shortest time (s) before it changes strafing direction
    strafeMax: 2.2, // both difficulties: longest time (s) before it changes strafing direction
    rangeMage: 460, // both difficulties: distance it likes to keep as a Mage
    rangeSheriff: 380, // both difficulties: distance it likes to keep as a Sheriff
    rangeRefractor: 320, // both difficulties: distance it likes to keep as a Refractor
    rangeBuilder: 260, // both difficulties: distance it likes to keep as a Builder
    wallMargin: 140, // both difficulties: how close to a wall it gets before steering back to the middle
  },

  // ---------------------------------------------------------------- MAGE ----
  mage: {
    staff: {
      damage: 45, // LC: damage per bolt
      physics: 1, // LC: how hard bolts shove physics objects (1 = normal)
      speed: 650, // LC: bolt speed
      size: 10, // LC: bolt radius
      fireInterval: 0.45, // LC: seconds between bolts (hold to keep firing)
    },
    shield: {
      charges: 2, // RC: shields stored up
      chargeTime: 10, // RC: seconds for one stored shield to come back
      duration: 3, // RC: seconds before the shield breaks by itself
      speed: 110, // RC: how fast it drifts forward
      distance: 60, // RC: how far in front of the Mage it appears
      arcDegrees: 110, // RC: how far it curves around the Mage (degrees)
      pieces: 5, // RC: straight pieces the curve is made of (more = smoother)
      thickness: 10, // RC: thickness of the wall
      hp: 120, // RC: health of each piece (enemy hits wear it down)
    },
    watchtower: {
      startup: 1, // C: seconds to build before its aura switches on
      hp: 200, // C: health of the tower
      life: 10, // C: seconds it lasts once built
      auraRadius: 220, // C: size of the area around it where the Mage fires faster
      fireRateBonus: 1.6, // C: staff fire rate multiplier inside the aura (1.6 = 60% faster)
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
      fireInterval: 0.1, // LC: shortest time between shots (one shot per click; this just stops auto-clickers)
      speed: 1100, // LC: bullet speed
      damageNear: 22, // LC: damage at point blank (a shot per click, so this adds up fast)
      stunnedMultiplier: 2, // LC: damage is multiplied by this if the target is stunned (like the Piercing Bullet)
      physics: 1, // LC: how hard bullets shove physics objects like tumbleweeds and furniture (1 = normal)
      damageFar: 10, // LC: damage at long range
      falloffRange: 700, // LC: distance travelled at which damage has dropped to damageFar
      size: 10.5, // LC: bullet radius
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
      tossSpeed: 380, // C: speed it starts rolling at, in the direction you're aiming
      life: 8, // C: seconds before it crumbles on its own
      damage: 30, // C: damage to whoever it touches (the Sheriff too)
      stun: 1.3, // C: seconds the touched player can't move or use abilities
      restitution: 0.9, // C: bounciness off walls and structures (1 = no speed lost)
      shotImpulse: 700, // C: how much speed a projectile hit adds to it
      weight: 0.3, // C: how heavy it is when objects bump into each other (1 = like furniture; lower = gets knocked around more)
      friction: 0.6, // C: how quickly it slows down by itself (0 = rolls forever)
      size: 50, // C: radius of the tumbleweed
      charges: 3, // C: tumbleweeds stored up (like mirrors)
      chargeTime: 10, // C: seconds for one stored tumbleweed to come back
    },
    horse: {
      duration: 4, // V: seconds you ride
      hp: 250, // V: the horse's health (damage hits it first; leftover damage hurts you)
      speedMult: 1.5, // V: walking speed while riding (1 = normal)
      size: 34, // V: body radius while riding (normal is player.bodyRadius)
      trampleDamage: 40, // V: damage to the enemy when you run into them
      trampleKnockback: 900, // V: how hard they're shoved away
      trampleDelay: 1, // V: seconds before you can trample again
      cooldown: 14, // V: seconds before it can be called again
    },
    roll: {
      duration: 0.35, // SPACE: seconds the roll lasts
      invincible: 0.2, // SPACE: seconds of invincibility at the start of the roll
      distance: 300, // SPACE: how far the roll goes
      cooldown: 2.5, // SPACE: seconds before rolling again
    },
  },

  // ----------------------------------------------------------- REFRACTOR ----
  refractor: {
    shotgun: {
      pellets: 4, // LC: pellets per shot
      spread: 6, // LC: total spread of the pellets, in degrees
      damage: 18, // LC: damage per pellet
      physics: 0.4, // LC: how hard pellets shove physics objects (1 = normal)
      speed: 1000, // LC: pellet speed
      size: 5, // LC: pellet radius
      fireInterval: 0.5, // LC: seconds between shots
      splitAngle: 5, // LC: degrees between the two halves when a pellet doubles off your mirror
      maxDoublings: 3, // LC: how many of your mirrors a pellet can double off (3: 4 pellets -> 8 -> 16 -> 32)
    },
    ray: {
      pool: 100, // RC: size of the resource pool (bar next to the crosshair)
      drain: 40, // RC: pool used per second while firing
      refill: 12, // RC: pool regained per second when not firing
      refillDelay: 1, // RC: seconds of not firing before the pool starts refilling
      dps: 110, // RC: damage per second (same after bouncing off mirrors)
      maxReflections: 3, // RC: how many mirrors the beam can bounce off
      tickInterval: 0.1, // RC: seconds between damage ticks
      range: 2500, // RC: total beam length, including bounces
      width: 8, // RC: beam thickness (looks only)
    },
    mirror: {
      maxMirrors: 3, // C: mirrors you can have at once (placing another removes your oldest)
      charges: 3, // C: uses stored up
      chargeTime: 6, // C: seconds for one use to come back
      maxLength: 220, // C: longest mirror (dragging further places it automatically)
      minLength: 40, // C: shortest mirror (shorter drags are ignored)
      hp: 150, // C: mirror health
      life: 8, // C: seconds a mirror lasts before it breaks by itself
      thickness: 10, // C: mirror thickness (for collisions)
    },
    dash: {
      distance: 240, // SPACE: how far the dash goes
      duration: 0.15, // SPACE: seconds the dash takes
      cooldown: 5, // SPACE: seconds before dashing again
    },
    shatter: {
      radius: 250, // V: distance from a mirror that gets hurt
      damage: 40, // V: damage per mirror (near 2 mirrors = hit twice)
      cooldown: 20, // V: seconds before it can be used again
    },
  },

  // ------------------------------------------------------------- BUILDER ----
  builder: {
    nailgun: {
      fireInterval: 0.08, // LC: seconds between nails (hold to keep firing)
      speed: 700, // LC: nail speed
      damage: 8, // LC: damage per nail
      physics: 0.03, // LC: how hard nails shove physics objects like tumbleweeds and furniture (1 = normal; low because he fires so fast)
      ammo: 30, // LC: nails before the Builder has to reload
      reloadTime: 2, // LC: seconds to reload (starts by itself when the gun is empty)
      size: 8.08, // LC: nail radius
      spread: 0, // LC: random spread of the nails, in degrees
    },
    hammer: {
      damage: 60, // RC: damage to an enemy player hit by the swing
      knockback: 2200, // RC: how hard an enemy player is shoved away (starting speed; see player.knockFriction for how far that goes)
      structureDamage: 150, // RC: damage to enemy structures and furniture hit by the swing
      range: 70, // RC: reach of the swing, from the edge of the Builder's body
      arcDegrees: 120, // RC: how wide the swing is (degrees)
      flingSpeed: 1000, // RC: speed your furniture flies at when you hit it
      swingTime: 0.2, // RC: length of the swing animation (looks only)
      cooldown: 0.9, // RC: seconds between swings
    },
    wall: {
      maxWalls: 2, // C: walls you can have at once (placing another removes your oldest)
      charges: 2, // C: walls stored up
      chargeTime: 9, // C: seconds for one stored wall to come back
      maxLength: 200, // C: longest wall (dragging further places it automatically)
      minLength: 40, // C: shortest wall (shorter drags are ignored)
      hp: 500, // C: wall health
      life: 15, // C: seconds a wall lasts before it crumbles by itself
      thickness: 18, // C: wall thickness
      bricks: 5, // C: bricks fired when you smash your wall with the hammer
      brickDamage: 50, // C: damage per brick
      brickPhysics: 1, // C: how hard bricks shove physics objects (1 = normal)
      brickSpeed: 900, // C: brick speed
      brickSize: 9, // C: brick radius
      brickSpread: 10, // C: random spread of the bricks, in degrees (they leave straight out of the wall)
      brickRange: 450, // C: distance over which a brick slows to a stop (then it vanishes)
    },
    furniture: {
      charges: 3, // V: pieces of furniture stored up (like walls)
      chargeTime: 5, // V: seconds for one stored piece to come back
      maxFurniture: 6, // V: furniture you can have at once (building more removes your oldest)
      pushShare: 0.7, // V: when a player shoves it, this share of the movement goes to the furniture (1 = slides like nothing, 0 = immovable)
      shotImpulse: 1.5, // V: speed added to it per point of damage of a shot that hits it (gunfire nudges it)
      hp: 150, // V: damage it takes from the enemy before it breaks
      size: 40, // V: radius of the furniture
      spawnDistance: 75, // V: how far in front of the Builder it appears
      life: 30, // V: seconds before it falls apart by itself
      flingDamage: 100, // V: damage when flung furniture hits the enemy
      friction: 3, // V: how quickly it stops sliding when standing around
      flungFriction: 0.6, // V: how quickly it slows down after being flung (lower = flies further)
      minFlingSpeed: 200, // V: below this speed, flung furniture stops being dangerous
      restitution: 0.4, // V: bounciness off walls and structures
    },
    dash: {
      distance: 220, // SPACE: how far the dash goes
      duration: 0.15, // SPACE: seconds the dash takes
      cooldown: 4, // SPACE: seconds before dashing again
    },
  },

  visuals: {
    damageNumberLife: 0.9, // seconds a floating damage number stays on screen
    damageNumberRise: 60, // how far a damage number floats upwards over its life
    damageNumberMerge: 0.35, // hits on the same target this close together (seconds) add up into one number
    hpTrailDelay: 0.5, // seconds before the white "recent damage" chunk of an HP bar starts shrinking
    hpTrailSpeed: 600, // how fast (HP per second) the white damage chunk shrinks
    flashMinDamage: 15, // a hit this big (or bigger) flashes the victim white (small hits like nails and the Mind Ray don't)
    flashTime: 0.12, // seconds of the white hit flash
    shakeMinDamage: 40, // a hit this big (or bigger) shakes the screen
    shakeBase: 3, // screen shake strength (pixels) of the smallest shaking hit
    shakePerDamage: 0.05, // extra shake strength per point of damage
    shakeMax: 10, // strongest screen shake (pixels)
    shakeDecay: 60, // how fast the shake settles (pixels per second)
    particles: 1, // amount of spark particles (1 = normal, 0 = none, 2 = double)
  },
};

/** The shape of the tuning object. Code uses this type so typos are caught. */
export type Tuning = typeof TUNING;
