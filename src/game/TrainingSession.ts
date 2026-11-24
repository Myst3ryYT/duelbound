/**
 * A training session: you vs the training dummy.
 * Extra keys: switch class, reset the dummy, dummy shooting, cooldowns on/off,
 * and (until the menus exist) starting a bot match.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Keybinds } from '../config/keybinds.ts';
import type { InputSource } from '../input/InputSource.ts';
import { ACTIONS, type Fighter, type PlayerInput, type World } from '../sim/types.ts';
import { createTrainingWorld, resetHp } from '../sim/world.ts';
import { CLASS_ORDER, getClass } from '../sim/classes/registry.ts';
import type { Renderer } from '../render/Renderer.ts';
import { playSound } from '../audio/sfx.ts';
import { Session, type SessionRequest } from './Session.ts';

export class TrainingSession extends Session {
  classId: string;

  constructor(tuning: Tuning, keybinds: Keybinds, input: InputSource, renderer: Renderer, classId: string) {
    super(tuning, keybinds, input, renderer);
    this.classId = classId;
    this.world = this.newWorld();
  }

  private newWorld(): World {
    const old = this.world as World | undefined;
    const w = createTrainingWorld(this.tuning, this.classId);
    if (old) w.options = { ...old.options }; // keep training toggles when switching class
    this.prev.clear();
    this.renderer.reset();
    return w;
  }

  get player(): Fighter {
    return this.world.fighters.find((f) => f.kind === 'player')!;
  }
  get opponent(): Fighter {
    return this.world.fighters.find((f) => f.kind === 'dummy')!;
  }

  protected gatherInputs(local: PlayerInput): Map<number, PlayerInput> {
    return new Map([[this.player.id, local]]);
  }

  handleMenuKeys(): SessionRequest {
    if (this.input.consumeMenu('resetDummy')) {
      const d = this.opponent;
      d.x = d.vars.homeX;
      d.y = d.vars.homeY;
      d.stunT = 0;
      d.pullById = 0;
      resetHp(this.world, d);
      this.flushEvents();
    }
    if (this.input.consumeMenu('toggleCooldowns')) {
      const off = !this.world.options.cooldownsDisabled;
      this.world.options.cooldownsDisabled = off;
      if (off) for (const a of ACTIONS) this.player.cooldowns[a] = 0;
      playSound('ui_click');
    }
    if (this.input.consumeMenu('toggleDummyFire')) {
      this.world.options.dummyFires = !this.world.options.dummyFires;
      playSound('ui_click');
    }
    if (this.input.consumeMenu('nextClass')) {
      const i = CLASS_ORDER.indexOf(this.classId);
      this.classId = CLASS_ORDER[(i + 1) % CLASS_ORDER.length];
      this.world = this.newWorld();
      playSound('ui_click');
    }
    if (this.input.consumeMenu('startBotMatch')) return 'startBotMatch';
    if (this.input.consumeMenu('startBotMatchHard')) return 'startBotMatchHard';
    return null;
  }

  protected helpLines(): string[] {
    const onOff = (b: boolean) => (b ? 'ON' : 'OFF');
    return [
      `TRAINING - ${getClass(this.classId)?.name ?? 'no class'}`,
      `${this.key('nextClass')}  switch class`,
      `${this.key('resetDummy')}  reset dummy`,
      `${this.key('toggleDummyFire')}  dummy shoots: ${onOff(this.world.options.dummyFires)}`,
      `${this.key('toggleCooldowns')}  cooldowns: ${onOff(!this.world.options.cooldownsDisabled)}`,
      `${this.key('startBotMatch')}  fight the bot (normal)`,
      `${this.key('startBotMatchHard')}  fight the bot (hard)`,
      `${this.key('devPanel')}  dev panel   ${this.key('pause')}  pause`,
    ];
  }
}
