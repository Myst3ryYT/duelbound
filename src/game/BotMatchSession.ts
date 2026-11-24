/**
 * A best-of-3 match against the bot. You are the left player, the bot the right.
 * The round flow (countdown, clock, tie screen...) lives in the simulation (sim/match.ts).
 */
import type { Tuning } from '../config/tuning.ts';
import type { Keybinds } from '../config/keybinds.ts';
import type { InputSource, MenuAction } from '../input/InputSource.ts';
import type { Fighter, PlayerInput } from '../sim/types.ts';
import { createMatchWorld } from '../sim/world.ts';
import { getClass } from '../sim/classes/registry.ts';
import { BotBrain } from '../sim/bot.ts';
import type { Renderer } from '../render/Renderer.ts';
import { Session, type SessionRequest } from './Session.ts';

/** Training-only keys: ignored (and cleared) during a match. */
const TRAINING_KEYS: MenuAction[] = ['resetDummy', 'toggleCooldowns', 'toggleDummyFire', 'nextClass', 'startBotMatch'];

export class BotMatchSession extends Session {
  readonly playerClass: string;
  readonly botClass: string;
  private brain: BotBrain;

  constructor(tuning: Tuning, keybinds: Keybinds, input: InputSource, renderer: Renderer, playerClass: string, botClass: string) {
    super(tuning, keybinds, input, renderer);
    this.playerClass = playerClass;
    this.botClass = botClass;
    const botName = `Bot (${getClass(botClass)?.name ?? botClass})`;
    this.world = createMatchWorld(tuning, 'bot', [playerClass, botClass], ['You', botName]);
    this.brain = new BotBrain(this.opponent.id, Math.floor(Math.random() * 1e9));
    renderer.reset();
  }

  get player(): Fighter {
    return this.world.fighters.find((f) => f.side === 0)!;
  }
  get opponent(): Fighter {
    return this.world.fighters.find((f) => f.side === 1)!;
  }

  protected gatherInputs(local: PlayerInput): Map<number, PlayerInput> {
    return new Map([
      [this.player.id, local],
      [this.opponent.id, this.brain.think(this.world, this.tuning)],
    ]);
  }

  handleMenuKeys(): SessionRequest {
    for (const k of TRAINING_KEYS) this.input.consumeMenu(k);
    return null;
  }

  protected helpLines(): string[] {
    const me = getClass(this.playerClass)?.name ?? '';
    const them = getClass(this.botClass)?.name ?? '';
    return [`BOT MATCH - ${me} vs ${them}`, `${this.key('devPanel')}  dev panel   ${this.key('pause')}  pause`];
  }
}
