/**
 * The World: creating it, and advancing it one tick at a time.
 *
 * World coordinates: (0, 0) is the top-left corner of the arena and
 * (arenaSize, arenaSize) is the bottom-right corner.
 */
import type { Tuning } from '../config/tuning.ts';
import { ACTIONS, perAction, type Fighter, type PlayerInput, type World } from './types.ts';
import { clampToArena, moveFighter, separateFighters, updateAim } from './movement.ts';
import { runAbilities } from './abilities.ts';
import { updateProjectiles } from './projectiles.ts';
import { updateObjects } from './objects.ts';
import { collideFightersWithPlaceables, updatePlaceables } from './placeables.ts';
import { checkPullStuck, tickStatusTimers, updatePull } from './status.ts';
import { updateDummy } from './training.ts';
import { getClass } from './classes/registry.ts';
import { checkRoundEnd, newMatchState, spawnPoint, updateMatch } from './match.ts';

export { applyDamage, resetHp } from './damage.ts';

function newFighter(world: World, props: Partial<Fighter> & Pick<Fighter, 'kind' | 'side' | 'x' | 'y'>): Fighter {
  const f: Fighter = {
    id: world.nextId++,
    classId: 'none',
    name: 'Player',
    vx: 0,
    vy: 0,
    aimAngle: 0,
    aimX: props.x,
    aimY: props.y,
    hp: 1000,
    maxHp: 1000,
    radius: 22,
    prevButtons: perAction(false),
    cooldowns: perAction(0),
    cooldownTotals: perAction(0),
    charges: perAction(0),
    chargeMax: perAction(0),
    placing: null,
    rootedT: 0,
    stunT: 0,
    invulnT: 0,
    pullById: 0,
    pullT: 0,
    vars: {},
    ...props,
  };
  world.fighters.push(f);
  return f;
}

/** Build a fresh training world: one player on the left, the dummy on the right. */
export function createTrainingWorld(tuning: Tuning, classId: string): World {
  const world: World = {
    mode: 'training',
    tick: 0,
    time: 0,
    fighters: [],
    projectiles: [],
    placeables: [],
    objects: [],
    match: null,
    events: [],
    nextId: 1,
    options: { cooldownsDisabled: false, dummyFires: false },
  };
  const c = tuning.world.arenaSize / 2;
  const d = tuning.player.spawnDistance;
  newFighter(world, {
    kind: 'player',
    side: 0,
    classId,
    name: 'You',
    x: c - d,
    y: c,
    hp: tuning.player.maxHp,
    maxHp: tuning.player.maxHp,
    radius: tuning.player.bodyRadius,
    aimX: c,
    aimY: c,
  });
  newFighter(world, {
    kind: 'dummy',
    side: 1,
    name: 'Training Dummy',
    x: c + d,
    y: c,
    hp: tuning.training.dummyHp,
    maxHp: tuning.training.dummyHp,
    radius: tuning.training.dummyRadius,
    aimAngle: Math.PI, // faces the player
    vars: { homeX: c + d, homeY: c }, // where R puts it back
  });
  return world;
}

/**
 * Advance the world by one fixed tick.
 * `inputs` maps fighter id -> that fighter's input for this tick.
 * Fighters without an input (like the dummy) just stand still.
 */
export function stepWorld(world: World, inputs: Map<number, PlayerInput>, tuning: Tuning): void {
  const dt = 1 / tuning.world.tickRate;
  world.events.length = 0;

  // Match round flow: during the countdown and result screens everything is frozen
  // (players can still turn to aim).
  if (!updateMatch(world, tuning, dt)) {
    for (const f of world.fighters) {
      const input = inputs.get(f.id);
      if (!input) continue;
      updateAim(f, input);
      for (const a of ACTIONS) f.prevButtons[a] = input.buttons[a];
    }
    world.tick++;
    world.time += dt;
    return;
  }

  for (const f of world.fighters) {
    tickStatusTimers(f, dt);
    updatePull(world, f, dt);
    if (f.kind === 'dummy') {
      updateDummy(world, tuning, f, dt);
      continue;
    }
    const input = inputs.get(f.id);
    if (!input) continue;

    updateAim(f, input);
    if (f.rootedT > 0 || f.stunT > 0 || f.pullById) {
      f.vx = 0;
      f.vy = 0;
    } else moveFighter(f, input, tuning, dt);

    const cls = getClass(f.classId);
    if (cls) runAbilities(world, tuning, f, input, cls, dt);
    for (const a of ACTIONS) f.prevButtons[a] = input.buttons[a];
  }

  updateProjectiles(world, tuning, dt);
  updateObjects(world, tuning, dt);
  updatePlaceables(world, tuning, dt);

  separateFighters(world.fighters);
  collideFightersWithPlaceables(world);
  for (const f of world.fighters) {
    clampToArena(f, tuning.world.arenaSize);
    checkPullStuck(f, dt);
  }
  checkRoundEnd(world, tuning);

  world.tick++;
  world.time += dt;
}

/**
 * Build a real match: two players, round flow on.
 * classes and 
ames are [left player, right player].
 */
export function createMatchWorld(tuning: Tuning, mode: 'bot' | 'online', classes: [string, string], names: [string, string]): World {
  const world: World = {
    mode,
    tick: 0,
    time: 0,
    fighters: [],
    projectiles: [],
    placeables: [],
    objects: [],
    match: newMatchState(tuning),
    events: [],
    nextId: 1,
    options: { cooldownsDisabled: false, dummyFires: false },
  };
  for (const side of [0, 1] as const) {
    const p = spawnPoint(tuning, side);
    newFighter(world, {
      kind: 'player',
      side,
      classId: classes[side],
      name: names[side],
      x: p.x,
      y: p.y,
      hp: tuning.player.maxHp,
      maxHp: tuning.player.maxHp,
      radius: tuning.player.bodyRadius,
      aimAngle: side === 0 ? 0 : Math.PI,
    });
  }
  return world;
}

export function findFighter(world: World, id: number): Fighter | undefined {
  return world.fighters.find((f) => f.id === id);
}
