/**
 * Pause menu (Escape): resume, sound volume / mute, leave match.
 */
import { getVolume, isMuted, playSound, setMuted, setVolume } from '../audio/sfx.ts';

export class PauseMenu {
  private root: HTMLDivElement;

  constructor(
    parent: HTMLElement,
    private callbacks: { onResume: () => void; onLeave: () => void },
  ) {
    this.root = document.createElement('div');
    this.root.className = 'overlay';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="menu-box">
        <h1>PAUSED</h1>
        <button data-id="resume">Resume</button>
        <label>Volume <input data-id="volume" type="range" min="0" max="1" step="0.05"></label>
        <label><input data-id="mute" type="checkbox"> Mute</label>
        <button data-id="leave">Leave match</button>
      </div>`;
    parent.appendChild(this.root);

    const volume = this.el<HTMLInputElement>('volume');
    const mute = this.el<HTMLInputElement>('mute');
    volume.value = String(getVolume());
    mute.checked = isMuted();
    volume.addEventListener('input', () => setVolume(Number(volume.value)));
    volume.addEventListener('change', () => playSound('ui_click'));
    mute.addEventListener('change', () => setMuted(mute.checked));

    this.el('resume').addEventListener('click', () => {
      playSound('ui_click');
      this.callbacks.onResume();
    });
    this.el('leave').addEventListener('click', () => {
      playSound('ui_click');
      this.callbacks.onLeave();
    });
  }

  private el<T extends HTMLElement = HTMLElement>(id: string): T {
    return this.root.querySelector(`[data-id="${id}"]`) as T;
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  setOpen(open: boolean): void {
    this.root.hidden = !open;
  }
}
