/**
 * The App: which screen is showing, which session is running, and the main loop.
 *
 *   Main menu -> Host Match  -> (friend joins) -> character select -> online match
 *             -> Join Match  -> character select -> online match
 *             -> Play vs Bot -> character select (+ bot class, difficulty) -> bot match
 *             -> Training    -> character select -> training
 *
 * The simulation ticks at a fixed rate on a timer (so an online host keeps
 * running even if its window is in the background); drawing happens every frame.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Keybinds } from '../config/keybinds.ts';
import type { KeyboardMouseInput } from '../input/KeyboardMouseInput.ts';
import type { Renderer } from '../render/Renderer.ts';
import { CLASS_ORDER } from '../sim/classes/registry.ts';
import type { BotDifficulty } from '../sim/bot.ts';
import { PauseMenu } from '../ui/pauseMenu.ts';
import { DevPanel } from '../ui/devPanel.ts';
import { NetOverlay } from '../ui/netOverlay.ts';
import { MatchOverMenu } from '../ui/matchOverMenu.ts';
import { CharacterSelect, HostScreen, JoinScreen, MainMenu, MessageScreen, type CharSelection } from '../ui/menus.ts';
import { clearRoomFromUrl, copyText, roomFromUrl, shareLink } from '../platform/url.ts';
import type { Session } from './Session.ts';
import { TrainingSession } from './TrainingSession.ts';
import { BotMatchSession } from './BotMatchSession.ts';
import { OnlineGuest, OnlineHost, type OnlineGame, type OnlineUi } from './OnlineController.ts';

export class App {
  private session: Session | null = null;
  private online: OnlineGame | null = null;
  private lastClass = 'mage';
  private lastBot: CharSelection = { classId: 'mage', botClass: 'random', difficulty: 'normal' };

  readonly devPanel: DevPanel;
  private netOverlay: NetOverlay;
  private pauseMenu: PauseMenu;
  private matchOverMenu: MatchOverMenu;
  private mainMenu: MainMenu;
  private hostScreen: HostScreen;
  private joinScreen: JoinScreen;
  private charSelect: CharacterSelect;
  private messageScreen: MessageScreen;

  private tuning: Tuning;
  private keybinds: Keybinds;
  private input: KeyboardMouseInput;
  private renderer: Renderer;

  constructor(uiRoot: HTMLElement, tuning: Tuning, tuningSource: string, keybinds: Keybinds, input: KeyboardMouseInput, renderer: Renderer) {
    this.tuning = tuning;
    this.keybinds = keybinds;
    this.input = input;
    this.renderer = renderer;

    this.netOverlay = new NetOverlay(uiRoot);
    this.mainMenu = new MainMenu(uiRoot, {
      host: () => void this.hostMatch(),
      join: () => this.showOnly(() => this.joinScreen.open()),
      bot: () => this.chooseForBot(),
      training: () => this.chooseForTraining(),
    });
    this.hostScreen = new HostScreen(uiRoot, () => this.toMenu());
    this.joinScreen = new JoinScreen(uiRoot, { join: (code) => void this.joinMatch(code), back: () => this.toMenu() });
    this.charSelect = new CharacterSelect(uiRoot, keybinds);
    this.messageScreen = new MessageScreen(uiRoot);
    this.pauseMenu = new PauseMenu(uiRoot, {
      onResume: () => this.setPaused(false),
      onLeave: () => this.toMenu(),
    });
    this.matchOverMenu = new MatchOverMenu(uiRoot, {
      onRematch: () => this.rematch(),
      onLeave: () => this.toMenu(),
    });
    this.devPanel = new DevPanel(uiRoot, tuning, tuningSource, {
      damageOpponent: (n) => this.session?.damageOpponent(n),
      damageSelf: (n) => this.session?.damageSelf(n),
      healAll: () => this.session?.healAll(),
    });

    // Opened from a shared link? Go straight to joining that room.
    const code = roomFromUrl();
    clearRoomFromUrl();
    if (code) {
      this.showOnly(() => this.joinScreen.open(code));
      void this.joinMatch(code);
    } else this.showOnly(() => this.mainMenu.show());

    this.startLoop();
  }

  // --------------------------------------------------------------- screens ----

  /** Hide every menu screen, then run `show` to open one. */
  private showOnly(show?: () => void): void {
    for (const s of [this.mainMenu, this.hostScreen, this.joinScreen, this.charSelect, this.messageScreen]) s.hide();
    this.matchOverMenu.hide();
    this.pauseMenu.setOpen(false);
    show?.();
  }

  /** Back to the main menu, leaving any online game. */
  private toMenu(): void {
    this.online?.leave();
    this.online = null;
    this.setSession(null);
    this.showOnly(() => this.mainMenu.show());
  }

  private setSession(s: Session | null): void {
    this.session?.dispose();
    this.session = s;
    this.input.releaseAll();
    this.accumulator = 0;
  }

  private setPaused(p: boolean): void {
    this.pauseMenu.setOpen(p);
    this.input.releaseAll();
  }

  // -------------------------------------------------------- training / bot ----

  private chooseForTraining(): void {
    this.showOnly(() =>
      this.charSelect.open('training', { classId: this.lastClass }, {
        confirm: (sel) => {
          this.lastClass = sel.classId;
          this.showOnly();
          this.setSession(new TrainingSession(this.tuning, this.keybinds, this.input, this.renderer, sel.classId));
        },
        back: () => this.toMenu(),
      }),
    );
  }

  private chooseForBot(): void {
    this.showOnly(() =>
      this.charSelect.open('bot', { ...this.lastBot, classId: this.lastClass }, {
        confirm: (sel) => {
          this.lastClass = sel.classId;
          this.lastBot = sel;
          this.showOnly();
          this.startBotMatch(sel.classId, sel.botClass, sel.difficulty);
        },
        back: () => this.toMenu(),
      }),
    );
  }

  private startBotMatch(playerClass: string, botClass: string, difficulty: BotDifficulty): void {
    const bot = botClass === 'random' ? CLASS_ORDER[Math.floor(Math.random() * CLASS_ORDER.length)] : botClass;
    this.setSession(new BotMatchSession(this.tuning, this.keybinds, this.input, this.renderer, playerClass, bot, difficulty));
  }

  private rematch(): void {
    if (this.online) {
      this.online.rematch();
      return;
    }
    if (this.session instanceof BotMatchSession) {
      const s = this.session;
      this.showOnly();
      // Same classes again (a "Random" bot picks again).
      this.startBotMatch(s.playerClass, this.lastBot.botClass === 'random' ? 'random' : s.botClass, s.difficulty);
    }
  }

  // ---------------------------------------------------------------- online ----

  private onlineUi(): OnlineUi {
    return {
      showWaiting: (code) => {
        this.setSession(null);
        this.showOnly(() => this.hostScreen.showRoom(code, shareLink(code), copyText));
      },
      showLobby: (mine, theirs, fresh) => {
        if (fresh || !this.charSelect.isOpen) {
          this.setSession(null);
          this.showOnly(() =>
            this.charSelect.open('online', { classId: mine.classId }, {
              change: (classId, ready) => this.online?.pick(classId, ready),
              back: () => this.toMenu(),
            }),
          );
        }
        this.charSelect.setOpponent(theirs.classId, theirs.ready);
      },
      startSession: (s) => {
        this.showOnly();
        this.setSession(s);
      },
      rematchVotes: (me, them) => this.matchOverMenu.setStatus(me ? 'Waiting for your opponent...' : them ? 'Your opponent wants a rematch!' : ''),
      message: (title, text) => {
        this.setSession(null);
        this.showOnly(() =>
          this.messageScreen.open(title, text, () => {
            // A host's room stays open: go back to the code screen. Otherwise, main menu.
            if (this.online instanceof OnlineHost && this.online.waiting) this.onlineUi().showWaiting(this.online.code);
            else this.toMenu();
          }),
        );
      },
    };
  }

  private deps() {
    return { tuning: this.tuning, keybinds: this.keybinds, input: this.input, renderer: this.renderer, ui: this.onlineUi() };
  }

  private async hostMatch(): Promise<void> {
    this.showOnly(() => this.hostScreen.showOpening());
    try {
      const host = await OnlineHost.create(this.deps());
      if (!this.hostScreen.isOpen) host.leave(); // cancelled while opening
      else this.online = host;
    } catch (err) {
      this.hostScreen.showError((err as Error).message);
    }
  }

  private async joinMatch(code: string): Promise<void> {
    this.joinScreen.setBusy(true);
    this.joinScreen.setStatus('Connecting...');
    try {
      const guest = await OnlineGuest.join(code, this.deps());
      if (!this.joinScreen.isOpen && !this.charSelect.isOpen) guest.leave(); // backed out meanwhile
      else this.online = guest;
    } catch (err) {
      this.joinScreen.setBusy(false);
      this.joinScreen.setStatus((err as Error).message, true);
    }
  }

  // ------------------------------------------------------------- main loop ----

  private accumulator = 0;
  private lastTick = performance.now();
  private lastFrame = performance.now();

  private startLoop(): void {
    // Simulation: on a timer, so it keeps going while the window is in the background.
    window.setInterval(() => this.tick(), 4);
    // Drawing: every screen refresh.
    const frame = (now: number) => {
      this.draw(now);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private tick(): void {
    const now = performance.now();
    const s = this.session;
    // Allow catching up after a long pause only when online (offline games just skip the gap).
    const cap = s?.online ? 1 : 0.25;
    const dt = Math.min(cap, (now - this.lastTick) / 1000);
    this.lastTick = now;
    if (!s || !s.ready) return;

    if (this.input.consumeMenu('pause')) this.setPaused(!this.pauseMenu.isOpen);
    if (this.input.consumeMenu('devPanel')) this.devPanel.toggle();

    const paused = this.pauseMenu.isOpen && !s.online; // online games never pause
    if (paused) return;
    s.handleMenuKeys();
    const tickTime = 1 / this.tuning.world.tickRate;
    this.accumulator += dt;
    while (this.accumulator >= tickTime) {
      s.step();
      this.accumulator -= tickTime;
    }
  }

  private draw(now: number): void {
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const s = this.session;
    this.netOverlay.update(!!s?.online && s.ready);
    if (!s || !s.ready) {
      // Menus: also let the dev panel key work here.
      if (this.input.consumeMenu('devPanel')) this.devPanel.toggle();
      this.input.consumeMenu('pause');
      this.renderer.clear();
      return;
    }
    const paused = this.pauseMenu.isOpen && !s.online;
    const tickTime = 1 / this.tuning.world.tickRate;
    const rs = s.renderState(paused ? 1 : Math.min(1, this.accumulator / tickTime));
    this.renderer.render(rs.world, this.tuning, rs.prev, rs.alpha, paused ? 0 : dt, s.localView(), s.hud(), this.pauseMenu.isOpen || this.matchOverMenu.isOpen ? null : this.input.crosshair());

    // Match finished: show the end screen.
    if (s.matchOver && !this.matchOverMenu.isOpen) {
      const m = rs.world.match!;
      const winner = rs.world.fighters.find((f) => f.side === m.matchWinner);
      const reason = (s as { endReason?: string | null }).endReason;
      const title = winner === s.player ? 'You win!' : `${winner?.name ?? 'Nobody'} wins!`;
      this.matchOverMenu.show(title, reason ? `${reason}.` : '');
    }
  }
}
