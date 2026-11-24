/**
 * Entry point: sets everything up and runs the main loop.
 *
 * The loop runs the simulation at a fixed rate (60 ticks per second by
 * default) no matter how fast the screen refreshes, and draws as often as the
 * browser allows.
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
import { TrainingSession } from './game/TrainingSession.ts';
import { BotMatchSession } from './game/BotMatchSession.ts';
import type { Session } from './game/Session.ts';
import { CLASS_ORDER } from './sim/classes/registry.ts';
import { MatchOverMenu } from './ui/matchOverMenu.ts';
import { PauseMenu } from './ui/pauseMenu.ts';
import { DevPanel } from './ui/devPanel.ts';

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

// Training starts as the Mage (Tab switches class) until character select exists (build step 4).
let trainingClass = 'mage';
let session: Session = new TrainingSession(tuning, keybinds, input, renderer, trainingClass);

/** Go back to training, keeping the class you were last using. */
function toTraining(): void {
  session = new TrainingSession(tuning, keybinds, input, renderer, trainingClass);
}

/** Start a best-of-3 against the bot, with your current class. The bot picks a random class for now. */
function toBotMatch(playerClass: string, botClass = CLASS_ORDER[Math.floor(Math.random() * CLASS_ORDER.length)]): void {
  session = new BotMatchSession(tuning, keybinds, input, renderer, playerClass, botClass);
}

const pauseMenu = new PauseMenu(uiRoot, {
  onResume: () => setPaused(false),
  // No main menu yet (build step 4): leaving a match goes to training, leaving training restarts it.
  onLeave: () => {
    matchOverMenu.hide();
    toTraining();
    setPaused(false);
  },
});

const matchOverMenu = new MatchOverMenu(uiRoot, {
  onRematch: () => {
    matchOverMenu.hide();
    if (session instanceof BotMatchSession) toBotMatch(session.playerClass, session.botClass);
  },
  onLeave: () => {
    matchOverMenu.hide();
    toTraining();
  },
});

const devPanel = new DevPanel(uiRoot, tuning, tuningSource, {
  damageOpponent: (n) => session.damageOpponent(n),
  damageSelf: (n) => session.damageSelf(n),
  healAll: () => session.healAll(),
});

function setPaused(p: boolean): void {
  pauseMenu.setOpen(p);
  input.releaseAll();
}
// ---- Main loop ----
let last = performance.now();
let accumulator = 0;

function frame(now: number): void {
  const dt = Math.min(0.25, (now - last) / 1000); // cap so a frozen tab doesn't fast-forward
  last = now;

  if (input.consumeMenu('pause')) setPaused(!pauseMenu.isOpen);
  if (input.consumeMenu('devPanel')) devPanel.toggle();

  const tickTime = 1 / tuning.world.tickRate;
  if (!pauseMenu.isOpen) {
    const request = session.handleMenuKeys();
    if (request === 'startBotMatch' && session instanceof TrainingSession) {
      trainingClass = session.classId;
      toBotMatch(trainingClass);
    }
    accumulator += dt;
    while (accumulator >= tickTime) {
      session.step();
      accumulator -= tickTime;
    }
  }
  const alpha = pauseMenu.isOpen ? 1 : accumulator / tickTime;

  // Match finished: show the rematch screen.
  if (session.matchOver && !matchOverMenu.isOpen) {
    const winner = session.world.fighters.find((f) => f.side === session.world.match!.matchWinner);
    matchOverMenu.show(winner === session.player ? 'You win!' : `${winner?.name ?? 'Nobody'} wins!`);
  }

  renderer.render(
    session.world,
    tuning,
    session.prev,
    alpha,
    pauseMenu.isOpen ? 0 : dt,
    session.localView(),
    session.hud(),
    pauseMenu.isOpen ? null : input.crosshair(),
  );
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- Hot reload: editing the config files applies instantly, without restarting ----
if (import.meta.hot) {
  import.meta.hot.accept('./config/tuning.ts', (mod) => {
    if (mod) deepAssignNumbers(tuning, mod.TUNING);
    devPanel.refresh();
  });
  import.meta.hot.accept('./config/tuning.ts?raw', (mod) => {
    if (mod) devPanel.fileChanged(mod.default);
  });
  import.meta.hot.accept('./config/keybinds.ts', (mod) => {
    if (mod) Object.assign(keybinds, structuredClone(mod.KEYBINDS));
  });
}
