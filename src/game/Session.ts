/**
 * A Session runs one World: it gathers inputs, steps the simulation, and turns
 * the simulation's events into sounds and visuals. Training and bot matches are
 * both sessions (online matches will be too). This base class holds what they share.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Keybinds } from '../config/keybinds.ts';
import type { InputSource } from '../input/InputSource.ts';
import { keyLabel } from '../input/keyLabels.ts';
import { ACTIONS, type Fighter, type GameEvent, type PlayerInput, type World } from '../sim/types.ts';
import { applyDamage, resetHp, stepWorld } from '../sim/world.ts';
import { getClass } from '../sim/classes/registry.ts';
import { isReady } from '../sim/abilities.ts';
import type { LocalView, Renderer } from '../render/Renderer.ts';
import type { HudAbility, HudInfo } from '../render/hud.ts';
import { playSound, playSoundByName } from '../audio/sfx.ts';

export abstract class Session {
  world!: World;
  /** Positions from the previous tick (everything that moves), for smooth drawing between ticks. */
  prev = new Map<number, { x: number; y: number }>();
  protected tuning: Tuning;
  protected keybinds: Keybinds;
  protected input: InputSource;
  protected renderer: Renderer;

  constructor(tuning: Tuning, keybinds: Keybinds, input: InputSource, renderer: Renderer) {
    this.tuning = tuning;
    this.keybinds = keybinds;
    this.input = input;
    this.renderer = renderer;
  }

  /** The player sitting at this computer. */
  abstract get player(): Fighter;
  /** Whoever they're fighting (dummy, bot, or the other player). */
  abstract get opponent(): Fighter;
  /** Inputs for every fighter this tick (the local player's comes from the keyboard/mouse). */
  protected abstract gatherInputs(local: PlayerInput): Map<number, PlayerInput>;
  /** Text shown bottom-left. */
  protected abstract helpLines(): string[];

  /** Run one fixed simulation tick. */
  step(): void {
    const me = this.player;
    const inputs = this.gatherInputs(this.input.sample(this.renderer.view.screenToWorld, me.x, me.y));
    this.prev.clear();
    for (const f of this.world.fighters) this.prev.set(f.id, { x: f.x, y: f.y });
    for (const p of this.world.projectiles) this.prev.set(p.id, { x: p.x, y: p.y });
    for (const o of this.world.objects) this.prev.set(o.id, { x: o.x, y: o.y });
    stepWorld(this.world, inputs, this.tuning);
    this.flushEvents();
  }

  /** Session-specific keys. Call once per frame. */
  handleMenuKeys(): void {}

  /** False until there is something to draw (the online guest waits for the first snapshot). */
  get ready(): boolean {
    return true;
  }

  /** Online sessions keep running while the pause menu is open. */
  get online(): boolean {
    return false;
  }

  /** A message across the screen (e.g. 'Opponent disconnected'), or null. */
  banner(): string | null {
    return null;
  }

  /**
   * What to draw this frame. Normally the current world, blended with the previous
   * tick by lpha. The online guest overrides this to draw slightly in the past.
   */
  renderState(alpha: number): { world: World; prev: Map<number, { x: number; y: number }>; alpha: number } {
    return { world: this.world, prev: this.prev, alpha };
  }

  /** Clean up when leaving this session. */
  dispose(): void {}

  /** True when the match has ended (training never ends). */
  get matchOver(): boolean {
    return this.world.match?.phase === 'matchOver';
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
    return {
      helpLines: this.helpLines(),
      abilities: this.abilityHud(),
      roundTimeTotal: this.tuning.match.roundTime,
      roundsToWin: this.tuning.match.roundsToWin,
      banner: this.banner(),
    };
  }

  protected key(name: keyof Keybinds): string {
    return keyLabel(this.keybinds[name][0]);
  }

  private abilityHud(): HudAbility[] {
    const me = this.player;
    const cls = getClass(me.classId);
    if (!cls) return [];
    return ACTIONS.map((slot) => ({
      icon: cls.abilities[slot].icon,
      name: cls.abilities[slot].name,
      key: keyLabel(this.keybinds[slot][0]),
      cooldown: me.cooldowns[slot],
      total: me.cooldownTotals[slot],
      active: me.placing === slot,
      count: slot === 'primary' ? cls.ammo?.(me, this.tuning)?.current : undefined,
      charges: me.chargeMax[slot] > 0 ? me.charges[slot] : undefined,
      chargeMax: me.chargeMax[slot] > 0 ? me.chargeMax[slot] : undefined,
      ready: isReady(me, slot) || (me.chargeMax[slot] === 0 && me.cooldownTotals[slot] < 0.75), // tiny cooldowns (fire rate) don't flash the icon
    }));
  }

  // ---- Dev panel test buttons ----
  damageOpponent(amount: number): void {
    applyDamage(this.world, this.opponent, amount, this.player.id);
    this.flushEvents();
  }
  damageSelf(amount: number): void {
    applyDamage(this.world, this.player, amount, this.opponent.id);
    this.flushEvents();
  }
  healAll(): void {
    for (const f of this.world.fighters) resetHp(this.world, f);
    this.flushEvents();
  }

  /** Turn simulation events into sounds and visual effects, then clear them. */
  protected flushEvents(): void {
    this.playEvents(this.world.events, this.world);
    this.world.events.length = 0;
  }

  /** Play sounds and effects for simulation events. */
  protected playEvents(events: GameEvent[], world: World): void {
    for (const e of events) {
      this.renderer.onEvent(e, world);
      if (e.type === 'damage') playSound('hit');
      if (e.type === 'hpReset') playSound('reset');
      if (e.type === 'sound') playSoundByName(e.sound);
    }
  }
}
