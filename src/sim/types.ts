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

/** Makes { primary: v, secondary: v, ... } */
export function perAction<T>(v: T): Record<ActionName, T> {
  return { primary: v, secondary: v, ability1: v, ability2: v, mobility: v };
}

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
  return { seq: 0, moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: perAction(false) };
}

/** A character in the arena: a player or the training dummy. */
export interface Fighter {
  id: number;
  kind: 'player' | 'dummy';
  side: 0 | 1; // 0 = left HP bar, 1 = right HP bar
  classId: string; // which class this fighter plays ('none' for the dummy)
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

  // ---- Abilities ----
  cooldowns: Record<ActionName, number>; // seconds left before each ability is ready
  cooldownTotals: Record<ActionName, number>; // full length of the current cooldown (for the HUD)
  placing: ActionName | null; // a "variable" ability waiting for a click, or null
  rootedT: number; // seconds left where the fighter can't walk
  shieldT: number; // seconds left of a reflective shield
  shieldRadius: number; // size of that shield
  /** Free-form numbers abilities use to remember things (charge time, teleport target...). */
  vars: Record<string, number>;
}

/** A flying projectile. Moves in a straight line unless something (like Switch) turns it. */
export interface Projectile {
  id: number;
  ownerId: number; // who it belongs to (it never hurts its owner)
  kind: string; // which sprite to draw (see config/assets.ts)
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number; // visual radius; the hitbox is bigger (tuning.projectiles.hitboxScale)
  damage: number;
  life: number; // seconds left before it vanishes on its own
  // Switch: the projectile turns around over `switchTotal` seconds.
  switchT: number; // seconds left of the turn (0 = not turning)
  switchTotal: number;
  switchVx: number; // velocity when the turn started
  switchVy: number;
}

/** A structure on the map (watchtower, mirror...). Blocks movement, can be shot down. */
export interface Placeable {
  id: number;
  ownerId: number;
  kind: string; // which behaviour + sprite (see sim/classes/registry.ts)
  x: number;
  y: number;
  angle: number;
  radius: number; // collision circle
  hp: number;
  maxHp: number;
  age: number; // seconds since placed
  timer: number; // free timer for the behaviour (e.g. time to next shot)
}

/** Things that happened during a tick. The game layer turns these into sounds and effects. */
export type GameEvent =
  | { type: 'damage'; targetId: number; sourceId: number; amount: number; x: number; y: number }
  | { type: 'hpReset'; targetId: number }
  | { type: 'sound'; sound: string; x: number; y: number }
  | { type: 'fx'; fx: 'ring' | 'burst'; x: number; y: number; color: string; radius: number; duration: number };

/** Match modes. More arrive with the menus and online play. */
export type GameMode = 'training';

export interface World {
  mode: GameMode;
  tick: number; // how many simulation steps have run
  time: number; // seconds since the world was created
  fighters: Fighter[];
  projectiles: Projectile[];
  placeables: Placeable[];
  events: GameEvent[]; // cleared at the start of every tick
  nextId: number;
  options: {
    cooldownsDisabled: boolean; // training option: abilities have no cooldown
  };
}
