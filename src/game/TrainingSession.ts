/**
 * A training session: you vs the training dummy.
 * Connects input -> simulation -> effects (visuals + sound).
 */
import type { Tuning } from '../config/tuning.ts';
import type { Keybinds } from '../config/keybinds.ts';
import type { InputSource } from '../input/InputSource.ts';
import { keyLabel } from '../input/keyLabels.ts';
import { ACTIONS, type Fighter, type PlayerInput, type World } from '../sim/types.ts';
import { applyDamage, createTrainingWorld, resetHp, stepWorld } from '../sim/world.ts';
import { getClass } from '../sim/classes/registry.ts';
import type { LocalView, Renderer } from '../render/Renderer.ts';
import type { HudInfo } from '../render/hud.ts';
import { playSound, playSoundByName } from '../audio/sfx.ts';

export class TrainingSession {
  world: World;
  /** Positions from the previous tick (fighters and projectiles), for smooth drawing between ticks. */
  prev = new Map<number, { x: number; y: number }>();

  constructor(
    private tuning: Tuning,
    private keybinds: Keybinds,
    private input: InputSource,
    private renderer: Renderer,
    classId: string,
  ) {
    this.world = createTrainingWorld(tuning, classId);
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
    for (const p of this.world.projectiles) this.prev.set(p.id, { x: p.x, y: p.y });

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
      const off = !this.world.options.cooldownsDisabled;
      this.world.options.cooldownsDisabled = off;
      if (off) for (const a of ACTIONS) this.player.cooldowns[a] = 0;
      playSound('ui_click');
    }
  }

  /** What the renderer needs to know about the local player. */
  localView(): LocalView {
    const me = this.player;
    const def = me.placing ? getClass(me.classId)?.abilities[me.placing] : undefined;
    return { playerId: me.id, preview: def?.preview?.(this.world, this.tuning, me) ?? null };
  }

  hud(): HudInfo {
    const me = this.player;
    const k = (name: keyof Keybinds) => keyLabel(this.keybinds[name][0]);
    const cd = this.world.options.cooldownsDisabled ? 'OFF' : 'ON';
    const cls = getClass(me.classId);
    return {
      helpLines: [
        `TRAINING - ${cls?.name ?? 'no class'}`,
        `${k('resetDummy')}  reset dummy HP`,
        `${k('toggleCooldowns')}  cooldowns ${cd}`,
        `${k('devPanel')}  dev panel`,
        `${k('pause')}  pause`,
      ],
      abilities: cls
        ? ACTIONS.map((slot) => ({
            icon: cls.abilities[slot].icon,
            name: cls.abilities[slot].name,
            key: keyLabel(this.keybinds[slot][0]),
            cooldown: me.cooldowns[slot],
            total: me.cooldownTotals[slot],
            active: me.placing === slot,
          }))
        : [],
    };
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
      if (e.type === 'sound') playSoundByName(e.sound);
    }
    this.world.events.length = 0;
  }
}
