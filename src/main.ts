/**
 * Entry point: loads the config and art, then hands over to the App
 * (src/game/App.ts), which runs the menus, sessions and the main loop.
 */
import './style.css';
import { TUNING, type Tuning } from './config/tuning.ts';
import tuningSource from './config/tuning.ts?raw';
import { KEYBINDS, type Keybinds } from './config/keybinds.ts';
import { deepAssignNumbers } from './dev/tuningFile.ts';
import { KeyboardMouseInput } from './input/KeyboardMouseInput.ts';
import { View } from './render/view.ts';
import { Renderer } from './render/Renderer.ts';
import { loadSprites } from './render/sprites.ts';
import { App } from './game/App.ts';

// Live copies of the config. The dev panel and hot reload change these in place,
// so every part of the game always sees the current numbers.
const tuning: Tuning = structuredClone(TUNING);
const keybinds: Keybinds = structuredClone(KEYBINDS);

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root')!;

loadSprites();
const view = new View(canvas);
const renderer = new Renderer(canvas, view);
const input = new KeyboardMouseInput(keybinds, canvas, view.clientToScreen);
const app = new App(uiRoot, tuning, tuningSource, keybinds, input, renderer);

// ---- Hot reload: editing the config files applies instantly, without restarting ----
if (import.meta.hot) {
  import.meta.hot.accept('./config/tuning.ts', (mod) => {
    if (mod) deepAssignNumbers(tuning, mod.TUNING);
    app.devPanel.refresh();
  });
  import.meta.hot.accept('./config/tuning.ts?raw', (mod) => {
    if (mod) app.devPanel.fileChanged(mod.default);
  });
  import.meta.hot.accept('./config/keybinds.ts', (mod) => {
    if (mod) Object.assign(keybinds, structuredClone(mod.KEYBINDS));
  });
}
