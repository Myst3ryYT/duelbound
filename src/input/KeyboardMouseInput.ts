/**
 * Keyboard + mouse input, using the bindings in config/keybinds.ts.
 */
import type { Keybinds, BindName } from '../config/keybinds.ts';
import { ACTIONS, emptyInput, type PlayerInput } from '../sim/types.ts';
import type { InputSource, MenuAction } from './InputSource.ts';

const MENU_ACTIONS: MenuAction[] = ['pause', 'devPanel', 'resetDummy', 'toggleCooldowns', 'toggleDummyFire', 'nextClass', 'startBotMatch', 'startBotMatchHard'];

export class KeyboardMouseInput implements InputSource {
  /** Keys/buttons currently held down, by code ("KeyW", "Mouse0"...). */
  private held = new Set<string>();
  /** Keys pressed since the last tick, so a very quick tap is never missed. */
  private tapped = new Set<string>();
  /** Menu presses waiting to be consumed. */
  private menuPresses = new Set<MenuAction>();
  private mouseScreen: { x: number; y: number } | null = null;
  private seq = 0;

  /**
   * @param keybinds   live keybinding object (edits apply instantly)
   * @param surface    the element mouse clicks count on (the game canvas)
   * @param toScreen   converts a mouse event position to 1920x1080 screen units
   */
  constructor(
    private keybinds: Keybinds,
    surface: HTMLElement,
    private toScreen: (clientX: number, clientY: number) => { x: number; y: number },
  ) {
    window.addEventListener('keydown', (e) => {
      // Typing a number in a dev panel box shouldn't move the player,
      // but menu keys (pause, dev panel) always work.
      if (isTypingTarget(e.target) && !this.isMenuKey(e.code)) return;
      if (this.isBound(e.code)) e.preventDefault(); // e.g. stop Space from scrolling the page
      if (e.repeat) return;
      this.press(e.code);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    surface.addEventListener('mousedown', (e) => {
      e.preventDefault();
      // Clicking the game takes keyboard focus back from any menu slider or box.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      this.press('Mouse' + e.button);
    });
    window.addEventListener('mouseup', (e) => this.held.delete('Mouse' + e.button));
    surface.addEventListener('contextmenu', (e) => e.preventDefault()); // right click is an ability, not a menu
    window.addEventListener('mousemove', (e) => {
      this.mouseScreen = this.toScreen(e.clientX, e.clientY);
    });
    document.documentElement.addEventListener('mouseleave', () => (this.mouseScreen = null));
    window.addEventListener('blur', () => this.releaseAll()); // alt-tab: let go of everything
  }

  private press(code: string): void {
    this.held.add(code);
    this.tapped.add(code);
    for (const m of MENU_ACTIONS) if (this.keybinds[m].includes(code)) this.menuPresses.add(m);
  }

  private isMenuKey(code: string): boolean {
    return MENU_ACTIONS.some((m) => this.keybinds[m].includes(code));
  }

  private isBound(code: string): boolean {
    for (const name in this.keybinds) if (this.keybinds[name as BindName].includes(code)) return true;
    return false;
  }

  /** Is any key bound to this name held (or tapped since last tick)? */
  private down(name: BindName): boolean {
    return this.keybinds[name].some((code) => this.held.has(code) || this.tapped.has(code));
  }

  sample(toWorld: (sx: number, sy: number) => { x: number; y: number }, fighterX: number, fighterY: number): PlayerInput {
    const input = emptyInput();
    input.seq = ++this.seq;
    input.moveX = (this.down('moveRight') ? 1 : 0) - (this.down('moveLeft') ? 1 : 0);
    input.moveY = (this.down('moveDown') ? 1 : 0) - (this.down('moveUp') ? 1 : 0);
    if (this.mouseScreen) {
      const w = toWorld(this.mouseScreen.x, this.mouseScreen.y);
      input.aimX = w.x;
      input.aimY = w.y;
    } else {
      // Mouse outside the window: keep aiming to the right of the player.
      input.aimX = fighterX + 100;
      input.aimY = fighterY;
    }
    for (const a of ACTIONS) input.buttons[a] = this.down(a);
    this.tapped.clear();
    return input;
  }

  consumeMenu(action: MenuAction): boolean {
    const had = this.menuPresses.has(action);
    this.menuPresses.delete(action);
    return had;
  }

  crosshair(): { x: number; y: number } | null {
    return this.mouseScreen;
  }

  releaseAll(): void {
    this.held.clear();
    this.tapped.clear();
  }
}

/** Text and number boxes need the keyboard; sliders, checkboxes and buttons don't. */
function isTypingTarget(t: EventTarget | null): boolean {
  if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true;
  return t instanceof HTMLInputElement && (t.type === 'text' || t.type === 'number');
}
