/**
 * The input abstraction.
 *
 * The game never reads the keyboard or mouse directly. It asks an InputSource
 * for a PlayerInput each tick, and for "menu" presses (pause, dev panel...).
 * Keyboard + mouse is one InputSource; a controller, a bot or a network peer
 * can be others, without the rest of the game changing.
 */
import type { PlayerInput } from '../sim/types.ts';

/** Non-gameplay buttons the game screens react to. */
export type MenuAction = 'pause' | 'devPanel' | 'resetDummy' | 'toggleCooldowns' | 'toggleDummyFire' | 'nextClass';

export interface InputSource {
  /**
   * Build this tick's input. `toWorld` converts a screen point to a world point,
   * `fighterX/Y` is where the player currently stands (useful for controllers).
   */
  sample(toWorld: (sx: number, sy: number) => { x: number; y: number }, fighterX: number, fighterY: number): PlayerInput;
  /** True once per press of a menu button (then resets). */
  consumeMenu(action: MenuAction): boolean;
  /** Where the on-screen crosshair should be drawn, in 1920x1080 screen units, or null to hide it. */
  crosshair(): { x: number; y: number } | null;
  /** Clear held keys (e.g. when a menu opens) so the player doesn't keep walking. */
  releaseAll(): void;
}
