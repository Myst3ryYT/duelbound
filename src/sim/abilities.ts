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
import { ACTIONS, type ActionName, type Fighter, type Placeable, type PlayerInput, type World } from './types.ts';

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
}

/** What a variable ability shows while you are choosing where to put it. */
export interface PlacementPreview {
  sprite: string;
  x: number;
  y: number;
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
  /** Variable abilities: what to show at the crosshair while placing. */
  preview?(world: World, tuning: Tuning, fighter: Fighter): PlacementPreview;
  /** Variable abilities: the player clicked. Return true if it was placed (starts the cooldown). */
  confirm?(ctx: AbilityContext): boolean;
}

/** Behaviour of a placed structure, registered by the class that owns it. */
export interface PlaceableKindDef {
  kind: string;
  update(p: Placeable, world: World, tuning: Tuning, dt: number): void;
}

export interface ClassDef {
  id: string;
  name: string;
  sprite: string; // sprite id for the character (config/assets.ts)
  abilities: Record<ActionName, AbilityDef>;
  placeables: PlaceableKindDef[];
}

// ---------------------------------------------------------------- helpers ----

export function isReady(f: Fighter, slot: ActionName): boolean {
  return f.cooldowns[slot] <= 0;
}

/** Start a cooldown (skipped when the training "cooldowns off" option is on). */
export function startCooldown(world: World, f: Fighter, slot: ActionName, seconds: number): void {
  const s = world.options.cooldownsDisabled ? 0 : seconds;
  f.cooldowns[slot] = s;
  f.cooldownTotals[slot] = s;
}

/** Give a cooldown back (e.g. a teleport that turned out to be blocked). */
export function refundCooldown(f: Fighter, slot: ActionName): void {
  f.cooldowns[slot] = 0;
}

/** Run all five abilities of one fighter for one tick. */
export function runAbilities(world: World, tuning: Tuning, f: Fighter, input: PlayerInput, cls: ClassDef, dt: number): void {
  for (const a of ACTIONS) f.cooldowns[a] = Math.max(0, f.cooldowns[a] - dt);

  const edges = (a: ActionName) => ({
    pressed: input.buttons[a] && !f.prevButtons[a],
    held: input.buttons[a],
    released: !input.buttons[a] && f.prevButtons[a],
  });
  const ctx = (slot: ActionName, e: { pressed: boolean; held: boolean; released: boolean }): AbilityContext => ({
    world,
    tuning,
    fighter: f,
    input,
    slot,
    dt,
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
    } else if (edges('primary').pressed && def.confirm?.(ctx(slot, edges(slot)))) {
      startCooldown(world, f, slot, def.cooldown(tuning));
      f.placing = null;
    }
  }

  // ---- Every ability's own logic ----
  for (const slot of ACTIONS) {
    const def = cls.abilities[slot];
    let e = edges(slot);
    if (clicksUsed && (slot === 'primary' || slot === 'secondary')) e = { pressed: false, held: false, released: e.released };
    if (slot === cancelledSlot) e = { ...e, pressed: false };

    if (def.activation === 'variable' && e.pressed && !f.placing && isReady(f, slot)) {
      f.placing = slot;
      continue;
    }
    def.update?.(ctx(slot, e));
  }
}
