/**
 * A training session: you vs the training dummy.
 * Connects input -> simulation -> effects (visuals + sound).
 */
import type { Tuning } from '../config/tuning.ts';
import type { Keybinds } from '../config/keybinds.ts';
import type { InputSource } from '../input/InputSource.ts';
import { keyLabel } from '../input/keyLabels.ts';
import type { Fighter, PlayerInput, World } from '../sim/types.ts';
import { applyDamage, createTrainingWorld, resetHp, stepWorld } from '../sim/world.ts';
import type { Renderer } from '../render/Renderer.ts';
import { playSound } from '../audio/sfx.ts';

export class TrainingSession {
  world: World;
  /** Fighter positions from the previous tick, for smooth drawing between ticks. */
  prev = new Map<number, { x: number; y: number }>();

  constructor(
    private tuning: Tuning,
    private keybinds: Keybinds,
    private input: InputSource,
    private renderer: Renderer,
  ) {
    this.world = createTrainingWorld(tuning);
    this.renderer.reset();
  }

  get player(): Fighter {
    return this.world.fighters.find((f) => f.kind === 'player')!;
  }
  get dummy(): Fighter {
    return this.world.fighters.find((f) => f.kind === 'dummy')!;
  }

  /** Run one fixed simulation tick. */
  step(): void {
    const me = this.player;
    const inputs = new Map<number, PlayerInput>();
    inputs.set(me.id, this.input.sample(this.renderer.view.screenToWorld, me.x, me.y));

    this.prev.clear();
    for (const f of this.world.fighters) this.prev.set(f.id, { x: f.x, y: f.y });

    stepWorld(this.world, inputs, this.tuning);
    this.flushEvents();
  }

  /** Training-only buttons. Call once per frame. */
  handleMenuKeys(): void {
    if (this.input.consumeMenu('resetDummy')) {
      resetHp(this.world, this.dummy);
      this.flushEvents();
    }
    if (this.input.consumeMenu('toggleCooldowns')) {
      this.world.options.cooldownsDisabled = !this.world.options.cooldownsDisabled;
      playSound('ui_click');
    }
  }

  helpLine(): string {
    const k = (name: keyof Keybinds) => keyLabel(this.keybinds[name][0]);
    const cd = this.world.options.cooldownsDisabled ? 'OFF' : 'ON';
    return `TRAINING   ${k('resetDummy')}: reset dummy   ${k('toggleCooldowns')}: cooldowns ${cd}   ${k('devPanel')}: dev panel   ${k('pause')}: pause`;
  }

  // ---- Dev panel test buttons ----
  damageDummy(amount: number): void {
    applyDamage(this.world, this.dummy, amount, this.player.id);
    this.flushEvents();
  }
  damageSelf(amount: number): void {
    applyDamage(this.world, this.player, amount, this.dummy.id);
    this.flushEvents();
  }
  healAll(): void {
    for (const f of this.world.fighters) resetHp(this.world, f);
    this.flushEvents();
  }

  /** Turn simulation events into sounds and visual effects, then clear them. */
  private flushEvents(): void {
    for (const e of this.world.events) {
      this.renderer.onEvent(e, this.world);
      if (e.type === 'damage') playSound('hit');
      if (e.type === 'hpReset') playSound('reset');
    }
    this.world.events.length = 0;
  }
}
