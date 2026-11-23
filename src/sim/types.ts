/**
 * Shared data types for the simulation.
 *
 * The simulation is the "rules of the game". It has no drawing, no sound and no
 * browser code, so the exact same files can later run on a server or inside a
 * desktop build. Everything it needs comes in as plain data (inputs + tuning),
 * and everything it produces is plain data (the World + events).
 */

/** The five ability slots every class has. Keys are set in config/keybinds.ts. */
export type ActionName = 'primary' | 'secondary' | 'ability1' | 'ability2' | 'mobility';
export const ACTIONS: readonly ActionName[] = ['primary', 'secondary', 'ability1', 'ability2', 'mobility'];

/**
 * What one player is doing during one simulation tick.
 * Keyboard/mouse (or later a controller) is turned into this by the input layer.
 * Online, this is exactly what the guest sends to the host.
 */
export interface PlayerInput {
  seq: number; // increasing counter, used later by the netcode
  moveX: number; // -1 (left) .. 1 (right)
  moveY: number; // -1 (up) .. 1 (down)
  aimX: number; // world position the player is aiming at
  aimY: number;
  buttons: Record<ActionName, boolean>; // true while the button is held
}

export function emptyInput(): PlayerInput {
  return {
    seq: 0,
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    buttons: { primary: false, secondary: false, ability1: false, ability2: false, mobility: false },
  };
}

/** A character in the arena: a player or the training dummy. */
export interface Fighter {
  id: number;
  kind: 'player' | 'dummy';
  side: 0 | 1; // 0 = left HP bar, 1 = right HP bar
  classId: string; // which class this fighter plays ('none' until classes exist)
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number; // radians, 0 = facing right
  aimX: number;
  aimY: number;
  hp: number;
  maxHp: number;
  radius: number; // body radius for movement collisions
  /** Which buttons were held last tick, so we can tell "just pressed" from "held". */
  prevButtons: Record<ActionName, boolean>;
}

/** Things that happened during a tick. The game layer turns these into sounds and effects. */
export type GameEvent =
  | { type: 'damage'; targetId: number; sourceId: number; amount: number; x: number; y: number }
  | { type: 'hpReset'; targetId: number };

/** Match modes. More arrive with the menus and online play. */
export type GameMode = 'training';

export interface World {
  mode: GameMode;
  tick: number; // how many simulation steps have run
  time: number; // seconds since the world was created
  fighters: Fighter[];
  events: GameEvent[]; // cleared at the start of every tick
  nextId: number;
  options: {
    cooldownsDisabled: boolean; // training option: abilities have no cooldown
  };
}
