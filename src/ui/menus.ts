/**
 * Menu screens (plain HTML on top of the game canvas):
 *  - MainMenu        Host Match / Join Match / Play vs Bot / Training Dummy
 *  - HostScreen      shows the room code and share link while waiting for a friend
 *  - JoinScreen      type a room code
 *  - CharacterSelect pick a class (and, vs the bot, its class and difficulty)
 *  - MessageScreen   a simple notice with an OK button
 *
 * Text on buttons and titles can be changed right here.
 */
import { playSound } from '../audio/sfx.ts';
import { CLASS_ORDER, getClass } from '../sim/classes/registry.ts';
import type { Keybinds } from '../config/keybinds.ts';
import { findSprite } from '../render/sprites.ts';

/** Base for a full-screen menu layer. */
class Screen {
  protected root: HTMLDivElement;
  constructor(parent: HTMLElement, html: string, extraClass = '') {
    this.root = document.createElement('div');
    this.root.className = `screen ${extraClass}`;
    this.root.hidden = true;
    this.root.innerHTML = html;
    parent.appendChild(this.root);
  }
  protected el<T extends HTMLElement = HTMLElement>(id: string): T {
    return this.root.querySelector(`[data-id="${id}"]`) as T;
  }
  protected onClick(id: string, fn: () => void): void {
    this.el(id).addEventListener('click', () => {
      playSound('ui_click');
      fn();
    });
  }
  show(): void {
    this.root.hidden = false;
  }
  hide(): void {
    this.root.hidden = true;
  }
  get isOpen(): boolean {
    return !this.root.hidden;
  }
}

// ------------------------------------------------------------------ main ----

export class MainMenu extends Screen {
  constructor(parent: HTMLElement, actions: { host: () => void; join: () => void; bot: () => void; training: () => void }) {
    super(
      parent,
      `<div class="menu-box wide">
        <h1 class="title">REBOUND</h1>
        <button data-id="host">Host Match</button>
        <button data-id="join">Join Match</button>
        <button data-id="bot">Play vs Bot</button>
        <button data-id="training">Training Dummy</button>
      </div>`,
    );
    this.onClick('host', actions.host);
    this.onClick('join', actions.join);
    this.onClick('bot', actions.bot);
    this.onClick('training', actions.training);
  }
}

// ------------------------------------------------------------------ host ----

export class HostScreen extends Screen {
  private copyLink: () => void = () => {};
  private copyCode: () => void = () => {};

  constructor(parent: HTMLElement, onCancel: () => void) {
    super(
      parent,
      `<div class="menu-box wide">
        <h1>HOST MATCH</h1>
        <div class="status" data-id="status">Opening room...</div>
        <div data-id="details" hidden>
          <div class="label">Room code</div>
          <div class="room-code" data-id="code"></div>
          <div class="label">Share this link</div>
          <input class="link" data-id="link" readonly>
          <div class="row">
            <button data-id="copyLink">Copy link</button>
            <button data-id="copyCode">Copy code</button>
          </div>
          <div class="status" data-id="waiting">Waiting for a friend to join...</div>
        </div>
        <button data-id="cancel">Cancel</button>
      </div>`,
    );
    this.onClick('cancel', onCancel);
    this.onClick('copyLink', () => this.copyLink());
    this.onClick('copyCode', () => this.copyCode());
  }

  showOpening(): void {
    this.el('status').textContent = 'Opening room...';
    this.el('status').classList.remove('error');
    this.el('details').hidden = true;
    this.show();
  }

  showRoom(code: string, link: string, copy: (text: string) => Promise<boolean>): void {
    this.el('status').textContent = '';
    this.el('details').hidden = false;
    this.el('code').textContent = code;
    this.el<HTMLInputElement>('link').value = link;
    this.el('waiting').textContent = 'Waiting for a friend to join...';
    const flash = (ok: boolean, what: string) => (this.el('waiting').textContent = ok ? `${what} copied!` : 'Copy blocked by the browser: select it and copy by hand.');
    this.copyLink = () => void copy(link).then((ok) => flash(ok, 'Link'));
    this.copyCode = () => void copy(code).then((ok) => flash(ok, 'Code'));
    this.show();
  }

  showError(message: string): void {
    this.el('status').textContent = message;
    this.el('status').classList.add('error');
    this.el('details').hidden = true;
    this.show();
  }
}

// ------------------------------------------------------------------ join ----

export class JoinScreen extends Screen {
  constructor(parent: HTMLElement, actions: { join: (code: string) => void; back: () => void }) {
    super(
      parent,
      `<div class="menu-box wide">
        <h1>JOIN MATCH</h1>
        <div class="label">Room code</div>
        <input class="code-input" data-id="code" maxlength="5" placeholder="ABCDE" autocomplete="off" spellcheck="false">
        <button data-id="join">Join</button>
        <div class="status" data-id="status"></div>
        <button data-id="back">Back</button>
      </div>`,
    );
    const input = this.el<HTMLInputElement>('code');
    const go = () => {
      if (input.value.trim().length > 0) actions.join(input.value);
    };
    this.onClick('join', go);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go();
    });
    input.addEventListener('input', () => (input.value = input.value.toUpperCase()));
    this.onClick('back', actions.back);
  }

  open(code = ''): void {
    const input = this.el<HTMLInputElement>('code');
    input.value = code;
    this.setStatus('');
    this.setBusy(false);
    this.show();
    input.focus();
  }

  setStatus(text: string, error = false): void {
    this.el('status').textContent = text;
    this.el('status').classList.toggle('error', error);
  }

  setBusy(busy: boolean): void {
    this.el<HTMLButtonElement>('join').disabled = busy;
    this.el<HTMLInputElement>('code').disabled = busy;
  }
}

// -------------------------------------------------------- character select ----

export type CharSelectMode = 'training' | 'bot' | 'online';

export interface CharSelection {
  classId: string;
  botClass: string; // 'random' or a class id
  difficulty: 'normal' | 'hard';
}

export class CharacterSelect extends Screen {
  private mode: CharSelectMode = 'training';
  private sel: CharSelection = { classId: 'mage', botClass: 'random', difficulty: 'normal' };
  private ready = false;
  private handlers: {
    confirm: (sel: CharSelection) => void;
    change: (classId: string, ready: boolean) => void;
    back: () => void;
  } = { confirm: () => {}, change: () => {}, back: () => {} };

  constructor(parent: HTMLElement, _keybinds: Keybinds) {
    super(
      parent,
      `<div class="menu-box xwide">
        <h1 data-id="title">CHOOSE YOUR CLASS</h1>
        <div class="cards" data-id="cards"></div>
        <div data-id="botOptions">
          <div class="label">Bot class</div>
          <div class="row" data-id="botClasses"></div>
          <div class="label">Difficulty</div>
          <div class="row" data-id="difficulty"></div>
        </div>
        <div class="status" data-id="opponent"></div>
        <div class="row">
          <button data-id="back">Back</button>
          <button class="primary" data-id="confirm">Confirm</button>
        </div>
      </div>`,
    );
    this.onClick('back', () => this.handlers.back());
    this.onClick('confirm', () => {
      if (this.mode === 'online') {
        this.ready = !this.ready;
        this.handlers.change(this.sel.classId, this.ready);
        this.refresh();
      } else this.handlers.confirm({ ...this.sel });
    });
  }

  /** Open the screen. `onChange` is for online (every pick/ready change), `onConfirm` for training/bot. */
  open(
    mode: CharSelectMode,
    initial: Partial<CharSelection>,
    handlers: { confirm?: (sel: CharSelection) => void; change?: (classId: string, ready: boolean) => void; back: () => void },
  ): void {
    this.mode = mode;
    this.sel = { ...this.sel, ...initial };
    this.ready = false;
    this.handlers = { confirm: handlers.confirm ?? (() => {}), change: handlers.change ?? (() => {}), back: handlers.back };
    this.el('title').textContent = mode === 'training' ? 'TRAINING: CHOOSE YOUR CLASS' : mode === 'bot' ? 'VS BOT: CHOOSE YOUR CLASS' : 'ONLINE: CHOOSE YOUR CLASS';
    this.el('botOptions').hidden = mode !== 'bot';
    this.el('opponent').textContent = mode === 'online' ? 'Opponent is choosing...' : '';
    this.buildCards();
    this.refresh();
    this.show();
  }

  /** Online: show what the other player is doing. */
  setOpponent(classId: string, ready: boolean): void {
    const name = getClass(classId)?.name ?? classId;
    this.el('opponent').textContent = ready ? `Opponent is ready as ${name}.` : `Opponent is choosing... (${name})`;
  }

  private buildCards(): void {
    const cards = this.el('cards');
    cards.innerHTML = '';
    for (const id of CLASS_ORDER) {
      const cls = getClass(id)!;
      const card = document.createElement('button');
      card.className = 'card';
      card.dataset.cls = id;
      const pic = document.createElement('canvas');
      pic.width = 96;
      pic.height = 96;
      const sprite = findSprite(cls.sprite);
      const ctx = pic.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      if (sprite) ctx.drawImage(sprite.image, 8, 8, 80, 80);
      const name = document.createElement('div');
      name.className = 'card-name';
      name.textContent = cls.name;
      // 5-star ratings instead of the ability list.
      const list = document.createElement('ul');
      for (const [label, stars] of [
        ['Difficulty', cls.ratings.difficulty],
        ['Mobility', cls.ratings.mobility],
        ['Damage', cls.ratings.damage],
      ] as const) {
        const li = document.createElement('li');
        const n = Math.max(0, Math.min(5, Math.round(stars)));
        li.innerHTML = `<b>${label}</b><span class="stars">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
        list.appendChild(li);
      }
      card.append(pic, name, list);
      card.addEventListener('click', () => {
        playSound('ui_click');
        this.sel.classId = id;
        if (this.mode === 'online') {
          this.ready = false;
          this.handlers.change(id, false);
        }
        this.refresh();
      });
      cards.appendChild(card);
    }

    const botRow = this.el('botClasses');
    botRow.innerHTML = '';
    for (const id of ['random', ...CLASS_ORDER]) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.dataset.bot = id;
      b.textContent = id === 'random' ? 'Random' : getClass(id)!.name;
      b.addEventListener('click', () => {
        playSound('ui_click');
        this.sel.botClass = id;
        this.refresh();
      });
      botRow.appendChild(b);
    }
    const diffRow = this.el('difficulty');
    diffRow.innerHTML = '';
    for (const d of ['normal', 'hard'] as const) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.dataset.diff = d;
      b.textContent = d === 'normal' ? 'Normal' : 'Hard';
      b.addEventListener('click', () => {
        playSound('ui_click');
        this.sel.difficulty = d;
        this.refresh();
      });
      diffRow.appendChild(b);
    }
  }

  private refresh(): void {
    for (const c of this.root.querySelectorAll<HTMLElement>('.card')) c.classList.toggle('selected', c.dataset.cls === this.sel.classId);
    for (const c of this.root.querySelectorAll<HTMLElement>('[data-bot]')) c.classList.toggle('selected', c.dataset.bot === this.sel.botClass);
    for (const c of this.root.querySelectorAll<HTMLElement>('[data-diff]')) c.classList.toggle('selected', c.dataset.diff === this.sel.difficulty);
    const confirm = this.el('confirm');
    confirm.textContent = this.mode === 'online' ? (this.ready ? 'Ready! (click to change)' : 'Ready') : 'Start';
    confirm.classList.toggle('selected', this.ready);
  }
}

// --------------------------------------------------------------- message ----

export class MessageScreen extends Screen {
  private ok: () => void = () => {};

  constructor(parent: HTMLElement) {
    super(
      parent,
      `<div class="menu-box wide">
        <h1 data-id="title"></h1>
        <div class="status" data-id="text"></div>
        <button data-id="ok">OK</button>
      </div>`,
    );
    this.onClick('ok', () => this.ok());
  }

  open(title: string, text: string, onOk: () => void): void {
    this.el('title').textContent = title;
    this.el('text').textContent = text;
    this.ok = onOk;
    this.show();
  }
}
