/**
 * Dev panel (toggle with the ` key by default).
 *
 * - A slider + number box for every value in config/tuning.ts. Changes apply live.
 * - "Save to tuning.ts" writes the current values back into the file
 *   (only while running `npm run dev`).
 * - Test buttons for dealing damage / healing.
 * - "Network test": fake latency / jitter / packet loss and the network overlay
 *   (these only affect this window and are not saved to the file).
 */
import type { Tuning } from '../config/tuning.ts';
import { NET_DEBUG } from '../net/netDebug.ts';
import { flattenTuning, deepAssignNumbers, parseTuningSource, type TuningLine } from '../dev/tuningFile.ts';

export interface DevPanelActions {
  damageOpponent: (amount: number) => void;
  damageSelf: (amount: number) => void;
  healAll: () => void;
}

export class DevPanel {
  private root: HTMLDivElement;
  private status!: HTMLDivElement;
  private rows = new Map<string, { range: HTMLInputElement; num: HTMLInputElement; row: HTMLDivElement }>();
  /** The values as they are in the file right now (for "Revert" and change highlighting). */
  private fileValues: Record<string, number> = {};

  constructor(
    parent: HTMLElement,
    private live: Tuning,
    fileSource: string,
    private actions: DevPanelActions,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'dev-panel';
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.build(fileSource);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }
  toggle(): void {
    this.root.hidden = !this.root.hidden;
    if (this.isOpen) this.refresh();
  }

  /** Called when tuning.ts changes on disk (hot reload): rebuild with the new comments/values. */
  fileChanged(fileSource: string): void {
    this.build(fileSource);
  }

  private build(fileSource: string): void {
    // Keep the status message across rebuilds (saving triggers a rebuild via hot reload).
    const oldStatus = this.status ? { text: this.status.textContent ?? '', color: this.status.style.color } : null;
    const lines = parseTuningSource(fileSource);
    this.fileValues = Object.fromEntries(lines.map((l) => [l.path, l.value]));
    this.rows.clear();
    this.root.innerHTML = '';

    const h = document.createElement('h2');
    h.textContent = 'Dev panel - tuning';
    this.root.appendChild(h);

    const fileButtons = this.buttonRow();
    if (import.meta.env.DEV) this.button(fileButtons, 'Save to tuning.ts', () => this.save());
    this.button(fileButtons, 'Revert to file', () => this.revert());
    this.button(fileButtons, 'Copy values', () => this.copy());

    const testButtons = this.buttonRow();
    this.button(testButtons, 'Damage opponent 100', () => this.actions.damageOpponent(100));
    this.button(testButtons, 'Damage me 100', () => this.actions.damageSelf(100));
    this.button(testButtons, 'Heal all', () => this.actions.healAll());

    this.status = document.createElement('div');
    this.status.className = 'status';
    this.root.appendChild(this.status);
    if (oldStatus) {
      this.status.textContent = oldStatus.text;
      this.status.style.color = oldStatus.color;
    } else if (!import.meta.env.DEV) this.setStatus('Saving to the file only works with npm run dev.');

    this.buildNetworkSection();

    // Group rows by their first path part ("player", "mage.staff" -> "mage"...).
    let currentGroup = '';
    for (const line of lines) {
      const group = line.path.split('.').slice(0, -1).join('.');
      if (group !== currentGroup) {
        currentGroup = group;
        const gh = document.createElement('h3');
        gh.textContent = group;
        this.root.appendChild(gh);
      }
      this.addRow(line);
    }
    this.refresh();
  }

  /** Fake bad-connection settings for testing online play. */
  private buildNetworkSection(): void {
    const gh = document.createElement('h3');
    gh.textContent = 'Network test (this window only)';
    this.root.appendChild(gh);
    const slider = (label: string, key: 'latencyMs' | 'jitterMs' | 'lossPct', max: number, hint: string) => {
      const row = document.createElement('div');
      row.className = 'dev-row';
      const top = document.createElement('div');
      top.className = 'top';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = label;
      const range = document.createElement('input');
      range.type = 'range';
      range.min = '0';
      range.max = String(max);
      range.step = '1';
      range.value = String(NET_DEBUG[key]);
      const num = document.createElement('input');
      num.type = 'number';
      num.value = String(NET_DEBUG[key]);
      const apply = (v: number) => {
        if (!Number.isFinite(v)) return;
        NET_DEBUG[key] = Math.max(0, v);
        range.value = num.value = String(NET_DEBUG[key]);
      };
      range.addEventListener('input', () => apply(Number(range.value)));
      num.addEventListener('change', () => apply(Number(num.value)));
      const h = document.createElement('div');
      h.className = 'hint';
      h.textContent = hint;
      top.append(name, range, num);
      row.append(top, h);
      this.root.appendChild(row);
    };
    slider('fake latency', 'latencyMs', 200, 'extra ping in milliseconds (round trip)');
    slider('fake jitter', 'jitterMs', 100, 'random extra delay per message, 0 to this many ms');
    slider('packet loss', 'lossPct', 30, '% of snapshots / inputs that get lost (each way)');
    const label = document.createElement('label');
    label.className = 'dev-check';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = NET_DEBUG.overlay;
    box.addEventListener('change', () => (NET_DEBUG.overlay = box.checked));
    label.append(box, ' show network overlay (ping, snapshot rate) during online matches');
    this.root.appendChild(label);
  }

  private buttonRow(): HTMLDivElement {
    const d = document.createElement('div');
    d.className = 'buttons';
    this.root.appendChild(d);
    return d;
  }

  private button(parent: HTMLElement, label: string, onClick: () => void): void {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', onClick);
    parent.appendChild(b);
  }

  private addRow(line: TuningLine): void {
    const row = document.createElement('div');
    row.className = 'dev-row';
    const top = document.createElement('div');
    top.className = 'top';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = line.path.split('.').pop()!;
    name.title = line.path;

    // Slider range: 0 .. 4x the file value (type in the box to go beyond).
    const base = Math.abs(line.value);
    const max = base === 0 ? 10 : base * 4;
    const isWhole = Number.isInteger(line.value) && base >= 10;
    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(line.value < 0 ? -max : 0);
    range.max = String(max);
    range.step = isWhole ? '1' : String(max / 400);
    const num = document.createElement('input');
    num.type = 'number';
    num.step = 'any';

    const apply = (v: number) => {
      if (!Number.isFinite(v)) return;
      setPath(this.live, line.path, v);
      this.refreshRow(line.path);
    };
    range.addEventListener('input', () => apply(Number(range.value)));
    num.addEventListener('change', () => apply(Number(num.value)));

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = line.comment;

    top.append(name, range, num);
    row.append(top, hint);
    this.root.appendChild(row);
    this.rows.set(line.path, { range, num, row });
  }

  /** Update every row from the live values. */
  refresh(): void {
    for (const path of this.rows.keys()) this.refreshRow(path);
  }

  private refreshRow(path: string): void {
    const r = this.rows.get(path);
    if (!r) return;
    const v = getPath(this.live, path);
    if (document.activeElement !== r.num) r.num.value = String(Number(v.toFixed(4)));
    r.range.value = String(v);
    r.row.classList.toggle('changed', v !== this.fileValues[path]);
  }

  private async save(): Promise<void> {
    try {
      const res = await fetch('/__dev/save-tuning', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(flattenTuning(this.live)),
      });
      if (!res.ok) throw new Error(await res.text());
      const { changed } = (await res.json()) as { changed: number };
      this.setStatus(changed ? `Saved ${changed} value(s) to src/config/tuning.ts` : 'Nothing changed.');
    } catch (err) {
      this.setStatus('Save failed: ' + String(err), true);
    }
  }

  private revert(): void {
    const nested: Record<string, unknown> = {};
    for (const [path, v] of Object.entries(this.fileValues)) setPath(nested, path, v);
    deepAssignNumbers(this.live, nested);
    this.refresh();
    this.setStatus('Reverted to the values in tuning.ts');
  }

  private copy(): void {
    const text = Object.entries(flattenTuning(this.live))
      .map(([k, v]) => `${k} = ${v}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(
      () => this.setStatus('Copied all values to the clipboard.'),
      () => this.setStatus('Clipboard blocked by the browser.', true),
    );
  }

  private setStatus(msg: string, error = false): void {
    this.status.textContent = msg;
    this.status.style.color = error ? '#e05050' : '#4cc36a';
  }
}

function getPath(obj: object, path: string): number {
  let o: unknown = obj;
  for (const k of path.split('.')) o = (o as Record<string, unknown>)?.[k];
  return typeof o === 'number' ? o : NaN;
}

function setPath(obj: object, path: string, v: number): void {
  const keys = path.split('.');
  let o = obj as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {};
    o = o[k] as Record<string, unknown>;
  }
  o[keys[keys.length - 1]] = v;
}
