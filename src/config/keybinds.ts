/**
 * ============================================================================
 *  REBOUND - KEYBINDINGS
 * ============================================================================
 *  Each action lists one or more keys. Changes apply live while the game runs.
 *
 *  Key names are physical key positions (so WASD stays in the same place on
 *  any keyboard layout). Common names:
 *    letters  KeyA ... KeyZ        numbers  Digit0 ... Digit9
 *    Space, Escape, Tab, Enter, ShiftLeft, ControlLeft, AltLeft, Backquote (the ` key)
 *    F1 ... F12, ArrowUp, ArrowDown, ArrowLeft, ArrowRight
 *  Mouse buttons:
 *    Mouse0 = left click, Mouse1 = middle click, Mouse2 = right click
 * ============================================================================
 */
export const KEYBINDS = {
  // ---- Movement ----
  moveUp: ['KeyW'],
  moveDown: ['KeyS'],
  moveLeft: ['KeyA'],
  moveRight: ['KeyD'],

  // ---- Abilities (same five slots for every class) ----
  primary: ['Mouse0'], // LC: base weapon
  secondary: ['Mouse2'], // RC
  ability1: ['KeyC'], // C
  ability2: ['KeyV'], // V
  mobility: ['Space'], // SPACE

  // ---- Menus and tools ----
  pause: ['Escape'], // open / close the pause menu
  devPanel: ['Backquote'], // open / close the dev tuning panel
  resetDummy: ['KeyR'], // training: refill the dummy's HP
  toggleCooldowns: ['KeyT'], // training: switch ability cooldowns on / off
  toggleDummyFire: ['KeyF'], // training: make the dummy shoot at you (on / off)
  nextClass: ['Tab'], // training: switch to the next class (until character select exists)
  startBotMatch: ['KeyB'], // training: start a match against the bot (until menus exist)
};

export type Keybinds = typeof KEYBINDS;
export type BindName = keyof Keybinds;
