/**
 * The World: creating it, and advancing it one tick at a time.
 *
 * World coordinates: (0, 0) is the top-left corner of the arena and
 * (arenaSize, arenaSize) is the bottom-right corner.
 */
import type { Tuning } from '../config/tuning.ts';
import { ACTIONS, emptyInput, type Fighter, type PlayerInput, type World } from './types.ts';
import { clampToArena, moveFighter, separateFighters, updateAim } from './movement.ts';

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
    prevButtons: { ...emptyInput().buttons },
    ...props,
  };
  world.fighters.push(f);
  return f;
}

/** Build a fresh training world: one player on the left, the dummy on the right. */
export function createTrainingWorld(tuning: Tuning): World {
  const world: World = {
    mode: 'training',
    tick: 0,
    time: 0,
    fighters: [],
    events: [],
    nextId: 1,
    options: { cooldownsDisabled: false },
  };
  const c = tuning.world.arenaSize / 2;
  const d = tuning.player.spawnDistance;
  newFighter(world, {
    kind: 'player',
    side: 0,
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

  for (const f of world.fighters) {
    const input = inputs.get(f.id);
    if (!input || f.kind === 'dummy') continue;
    updateAim(f, input);
    moveFighter(f, input, tuning, dt);
    // Abilities will read input.buttons vs f.prevButtons here (step 2).
    for (const a of ACTIONS) f.prevButtons[a] = input.buttons[a];
  }

  separateFighters(world.fighters);
  for (const f of world.fighters) clampToArena(f, tuning.world.arenaSize);

  world.tick++;
  world.time += dt;
}

/** Deal damage to a fighter. Only the simulation (the host, when online) calls this. */
export function applyDamage(world: World, target: Fighter, amount: number, sourceId: number): void {
  if (amount <= 0 || target.hp <= 0) return;
  const dealt = Math.min(target.hp, amount);
  target.hp -= dealt;
  world.events.push({ type: 'damage', targetId: target.id, sourceId, amount: dealt, x: target.x, y: target.y });
}

/** Refill a fighter's HP (training dummy reset, dev tools). */
export function resetHp(world: World, target: Fighter): void {
  target.hp = target.maxHp;
  world.events.push({ type: 'hpReset', targetId: target.id });
}

export function findFighter(world: World, id: number): Fighter | undefined {
  return world.fighters.find((f) => f.id === id);
}
