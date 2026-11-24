/**
 * End of match: winner, Rematch, and leave.
 */
import { playSound } from '../audio/sfx.ts';

export class MatchOverMenu {
  private root: HTMLDivElement;
  private title: HTMLHeadingElement;

  constructor(parent: HTMLElement, callbacks: { onRematch: () => void; onLeave: () => void }) {
    this.root = document.createElement('div');
    this.root.className = 'overlay overlay-low';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="menu-box">
        <h1 data-id="title"></h1>
        <div class="status" data-id="status"></div>
        <button data-id="rematch">Rematch</button>
        <button data-id="leave">Back to menu</button>
      </div>`;
    parent.appendChild(this.root);
    this.title = this.root.querySelector('[data-id="title"]')!;
    this.root.querySelector('[data-id="rematch"]')!.addEventListener('click', () => {
      playSound('ui_click');
      callbacks.onRematch();
    });
    this.root.querySelector('[data-id="leave"]')!.addEventListener('click', () => {
      playSound('ui_click');
      callbacks.onLeave();
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  show(winnerText: string, status = ''): void {
    this.title.textContent = winnerText;
    this.setStatus(status);
    this.root.hidden = false;
  }

  setStatus(text: string): void {
    (this.root.querySelector('[data-id="status"]') as HTMLElement).textContent = text;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
