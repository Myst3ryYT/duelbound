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
import { CLASS_ORDER, getClass } from '../sim/classes/registry.ts';
import { isReady } from '../sim/abilities.ts';
import type { LocalView, Renderer } from '../render/Renderer.ts';
import type { HudInfo } from '../render/hud.ts';
import { playSound, playSoundByName } from '../audio/sfx.ts';

export class TrainingSession {
  world: World;
  /** Positions from the previous tick (everything that moves), for smooth drawing between ticks. */
  prev = new Map<number, { x: number; y: number }>();

  constructor(
    private tuning: Tuning,
    private keybinds: Keybinds,
    private input: InputSource,
    private renderer: Renderer,
    private classId: string,
  ) {
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
    for (const o of this.world.objects) this.prev.set(o.id, { x: o.x, y: o.y });

    stepWorld(this.world, inputs, this.tuning);
    this.flushEvents();
  }

  /** Training-only buttons. Call once per frame. */
  handleMenuKeys(): void {
    if (this.input.consumeMenu('resetDummy')) {
      const d = this.dummy;
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
  }

  /** What the renderer needs to know about the local player (worked out every frame). */
  localView(): LocalView {
    const me = this.player;
    const cross = this.input.crosshair();
    const aim = cross ? this.renderer.view.screenToWorld(cross.x, cross.y) : null;
    const def = me.placing ? getClass(me.classId)?.abilities[me.placing] : undefined;
    const at = aim ?? { x: me.aimX, y: me.aimY };
    const preview = def?.preview?.(this.world, this.tuning, me, at.x, at.y) ?? null;
    // No uses left (e.g. all mirrors recharging): show it as blocked.
    if (preview && me.placing && !isReady(me, me.placing) && !me.vars.placeDrag) preview.valid = false;
    return { playerId: me.id, aim, preview };
  }

  hud(): HudInfo {
    const me = this.player;
    const k = (name: keyof Keybinds) => keyLabel(this.keybinds[name][0]);
    const onOff = (b: boolean) => (b ? 'ON' : 'OFF');
    const cls = getClass(me.classId);
    return {
      helpLines: [
        `TRAINING - ${cls?.name ?? 'no class'}`,
        `${k('nextClass')}  switch class`,
        `${k('resetDummy')}  reset dummy`,
        `${k('toggleDummyFire')}  dummy shoots: ${onOff(this.world.options.dummyFires)}`,
        `${k('toggleCooldowns')}  cooldowns: ${onOff(!this.world.options.cooldownsDisabled)}`,
        `${k('devPanel')}  dev panel   ${k('pause')}  pause`,
      ],
      abilities: cls
        ? ACTIONS.map((slot) => ({
            icon: cls.abilities[slot].icon,
            name: cls.abilities[slot].name,
            key: keyLabel(this.keybinds[slot][0]),
            cooldown: me.cooldowns[slot],
            total: me.cooldownTotals[slot],
            active: me.placing === slot,
            count: me.chargeMax[slot] > 0 ? me.charges[slot] : slot === 'primary' ? cls.ammo?.(me, this.tuning)?.current : undefined,
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
