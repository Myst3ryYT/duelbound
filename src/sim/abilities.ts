/**
 * The ability framework.
 *
 * Every ability is one file that exports an AbilityDef: some data (name, type,
 * icon, cooldown) plus small behaviour functions. A class is just five
 * abilities, one per slot (see sim/classes/).
 *
 * Two activation styles (from the brief):
 *  - instant:  the ability reacts to the button itself (in `update`).
 *  - variable: pressing the button enters "placing mode" with a preview;
 *              left click confirms (`confirm`), right click or the same key cancels.
 */
import type { Tuning } from '../config/tuning.ts';
import { ACTIONS, type ActionName, type Fighter, type PhysObject, type Placeable, type PlayerInput, type Projectile, type World } from './types.ts';

export type AbilityType = 'projectile' | 'placeable' | 'object' | 'misc';

/** Everything an ability's behaviour gets to look at each tick. */
export interface AbilityContext {
  world: World;
  tuning: Tuning;
  fighter: Fighter;
  input: PlayerInput;
  slot: ActionName;
  dt: number;
  pressed: boolean; // button went down this tick
  held: boolean; // button is down
  released: boolean; // button went up this tick
  stunned: boolean; // the fighter is stunned (buttons are all off while stunned)
}

/** What a variable ability shows while you are choosing where to put it. */
export interface PlacementPreview {
  sprite: string;
  x: number;
  y: number;
  x2?: number; // set for line-shaped structures (mirrors): the line goes from (x, y) to (x2, y2)
  y2?: number;
  angle: number;
  radius: number;
  valid: boolean;
}

export interface AbilityDef {
  id: string;
  name: string;
  type: AbilityType;
  activation: 'instant' | 'variable';
  icon: string; // sprite id for the HUD icon (config/assets.ts)
  /** Cooldown length in seconds (read from tuning so it can be tweaked live). */
  cooldown(t: Tuning): number;
  /** Runs every tick for the fighter that has this ability. */
  update?(ctx: AbilityContext): void;
  /** Variable abilities: what to show if placed at (x, y). */
  preview?(world: World, tuning: Tuning, fighter: Fighter, x: number, y: number): PlacementPreview;
  /** Variable abilities: the player clicked. Return true if it was placed (starts the cooldown). */
  confirm?(ctx: AbilityContext): boolean;
  /**
   * Variable abilities placed by dragging (e.g. mirrors): called every tick while placing,
   * with pressed / held / released describing the LEFT mouse button.
   * Return 'placed' when done (starts the cooldown), or null to keep going.
   */
  placingUpdate?(ctx: AbilityContext): 'placed' | null;
  /** Abilities with stored uses: how many can be stored. `cooldown` is then the time for one use to come back. */
  charges?(t: Tuning): number;
}

/** Behaviour of a placed structure, registered by the class that owns it. */
export interface PlaceableKindDef {
  kind: string;
  update(p: Placeable, world: World, tuning: Tuning, dt: number): void;
}

/** Behaviour of a physics object, registered by the class that owns it. */
export interface ObjectKindDef {
  kind: string;
  restitution(t: Tuning): number; // bounciness, 1 = keeps all speed
  friction(t: Tuning): number; // how fast it slows down by itself
  carry?(t: Tuning): number; // share of its speed a carried (stunned) fighter moves at
  carryDrag?(t: Tuning): number; // extra slowdown while carrying someone
  /** It touched a fighter. Return true to remove the object. */
  onTouch(world: World, tuning: Tuning, o: PhysObject, f: Fighter): boolean;
}

/** Extra effect when a projectile with this `behavior` hits a fighter (after damage). */
export type ProjectileHook = (world: World, tuning: Tuning, p: Projectile, target: Fighter) => void;

/** A small bar shown under the crosshair (charge, resource...). */
export interface CrosshairBar {
  fill: number; // 0..1
  rate?: number; // how fast fill grows per second (lets the screen animate it smoothly between ticks)
  color: string;
}

export interface ClassDef {
  id: string;
  name: string;
  sprite: string; // sprite id for the character (config/assets.ts)
  abilities: Record<ActionName, AbilityDef>;
  placeables?: PlaceableKindDef[];
  objects?: ObjectKindDef[];
  projectileHooks?: Record<string, ProjectileHook>;
  /** Optional bar next to the crosshair, e.g. the Mage's staff charge. */
  crosshairBar?(f: Fighter, t: Tuning): CrosshairBar | null;
  /** Optional ammo count, shown as pips under the crosshair and on the LC icon. */
  ammo?(f: Fighter, t: Tuning): { current: number; max: number; reloading: boolean } | null;
}

// ---------------------------------------------------------------- helpers ----

export function isReady(f: Fighter, slot: ActionName): boolean {
  return f.chargeMax[slot] > 0 ? f.charges[slot] >= 1 : f.cooldowns[slot] <= 0;
}

/**
 * The ability was used: start its cooldown (skipped when the training
 * "cooldowns off" option is on). For abilities with charges, this spends a
 * charge and starts the recharge timer if it isn't already running.
 */
export function startCooldown(world: World, f: Fighter, slot: ActionName, seconds: number): void {
  const s = world.options.cooldownsDisabled ? 0 : seconds;
  if (f.chargeMax[slot] > 0) {
    if (world.options.cooldownsDisabled) return;
    f.charges[slot] = Math.max(0, f.charges[slot] - 1);
    if (f.cooldowns[slot] > 0) return; // a recharge is already running
  }
  f.cooldowns[slot] = s;
  f.cooldownTotals[slot] = s;
}

/** Keep stored charges topped up over time. */
function updateCharges(world: World, tuning: Tuning, f: Fighter, slot: ActionName, def: AbilityDef): void {
  const max = def.charges?.(tuning) ?? 0;
  if (max <= 0) {
    f.chargeMax[slot] = 0;
    return;
  }
  if (f.chargeMax[slot] === 0) f.charges[slot] = max; // first tick: start full
  f.chargeMax[slot] = max;
  if (world.options.cooldownsDisabled) {
    f.charges[slot] = max;
    f.cooldowns[slot] = 0;
    return;
  }
  f.charges[slot] = Math.min(f.charges[slot], max);
  if (f.charges[slot] >= max || f.cooldowns[slot] > 0) return;
  if (f.cooldownTotals[slot] > 0) f.charges[slot]++; // one use came back
  f.cooldownTotals[slot] = 0;
  if (f.charges[slot] < max) {
    f.cooldowns[slot] = def.cooldown(tuning);
    f.cooldownTotals[slot] = f.cooldowns[slot];
  }
}

/** Give a cooldown back (e.g. a teleport that turned out to be blocked). */
export function refundCooldown(f: Fighter, slot: ActionName): void {
  f.cooldowns[slot] = 0;
}

/** Run all five abilities of one fighter for one tick. */
export function runAbilities(world: World, tuning: Tuning, f: Fighter, input: PlayerInput, cls: ClassDef, dt: number): void {
  for (const a of ACTIONS) {
    f.cooldowns[a] = Math.max(0, f.cooldowns[a] - dt);
    updateCharges(world, tuning, f, a, cls.abilities[a]);
  }
  const stunned = f.stunT > 0;
  if (stunned) f.placing = null;

  // While stunned every button counts as "not held", without firing a "released".
  const edges = (a: ActionName) =>
    stunned
      ? { pressed: false, held: false, released: false }
      : {
          pressed: input.buttons[a] && !f.prevButtons[a],
          held: input.buttons[a],
          released: !input.buttons[a] && f.prevButtons[a],
        };
  const ctx = (slot: ActionName, e: { pressed: boolean; held: boolean; released: boolean }): AbilityContext => ({
    world,
    tuning,
    fighter: f,
    input,
    slot,
    dt,
    stunned,
    ...e,
  });

  // ---- Placing mode: left click confirms, right click / same key cancels ----
  let clicksUsed = false; // while placing, clicks don't also fire LC / RC abilities
  let cancelledSlot: ActionName | null = null;
  if (f.placing) {
    const slot = f.placing;
    const def = cls.abilities[slot];
    clicksUsed = true;
    if (edges('secondary').pressed || edges(slot).pressed) {
      f.placing = null;
      cancelledSlot = slot;
    } else if (def.placingUpdate) {
      // Drag-placed (mirror): the ability reads the left mouse button itself.
      if (def.placingUpdate(ctx(slot, edges('primary'))) === 'placed') {
        startCooldown(world, f, slot, def.cooldown(tuning));
        f.placing = null;
      }
    } else if (edges('primary').pressed && def.confirm?.(ctx(slot, edges(slot)))) {
      startCooldown(world, f, slot, def.cooldown(tuning));
      f.placing = null;
    }
    if (!f.placing) f.vars.placeDrag = 0; // forget any half-finished drag
  }

  // ---- Every ability's own logic ----
  for (const slot of ACTIONS) {
    const def = cls.abilities[slot];
    let e = edges(slot);
    if (clicksUsed && (slot === 'primary' || slot === 'secondary')) e = { pressed: false, held: false, released: e.released };
    if (slot === cancelledSlot) e = { ...e, pressed: false };

    if (def.activation === 'variable' && e.pressed && !f.placing && isReady(f, slot)) {
      f.placing = slot;
      f.vars.placeDrag = 0;
      continue;
    }
    def.update?.(ctx(slot, e));
  }
}
