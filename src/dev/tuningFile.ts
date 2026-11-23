/**
 * Reads and rewrites the text of src/config/tuning.ts.
 *
 * Used by:
 *  - the dev panel (to show the comment next to each value)
 *  - the dev server's "Save" hook (to write slider values back into the file,
 *    keeping all comments and layout exactly as they were)
 *
 * Pure text processing: no browser or Node APIs, so both sides can use it.
 */

export interface TuningLine {
  path: string; // e.g. "player.moveSpeed"
  value: number;
  comment: string; // the text after "//" on that line
}

const VALUE_LINE = /^(\s*)(\w+)(\s*:\s*)(-?\d+(?:\.\d+)?)(.*)$/;
const GROUP_OPEN = /^(\w+)\s*:\s*\{$/;

/** Walk the file line by line, calling `onValue` for every "name: number," line. */
function walk(lines: string[], onValue: (path: string, lineIndex: number, match: RegExpMatchArray) => void): void {
  const stack: (string | null)[] = [];
  let inBlockComment = false;
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      return;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true;
      return;
    }
    const code = trimmed.replace(/\/\/.*$/, '').trim();
    const open = code.match(GROUP_OPEN);
    if (open) return void stack.push(open[1]);
    if (code.endsWith('{')) return void stack.push(null); // e.g. "export const TUNING = {"
    if (code.startsWith('}')) return void stack.pop();
    const m = line.match(VALUE_LINE);
    if (m && stack.length > 0) {
      const path = [...stack.filter((s): s is string => !!s), m[2]].join('.');
      onValue(path, i, m);
    }
  });
}

export function parseTuningSource(src: string): TuningLine[] {
  const out: TuningLine[] = [];
  walk(src.split(/\r?\n/), (path, _i, m) => {
    const comment = (m[5].match(/\/\/\s*(.*)$/)?.[1] ?? '').trim();
    out.push({ path, value: Number(m[4]), comment });
  });
  return out;
}

/** Round to at most 4 decimals and drop trailing zeros. */
export function formatNumber(v: number): string {
  return String(Number(v.toFixed(4)));
}

/**
 * Replace values in the file text. `values` maps path -> new number.
 * Returns the new text and how many lines changed.
 */
export function rewriteTuningSource(src: string, values: Record<string, number>): { text: string; changed: number } {
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const lines = src.split(/\r?\n/);
  let changed = 0;
  walk(lines, (path, i, m) => {
    const v = values[path];
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    const formatted = formatNumber(v);
    if (formatted === m[4]) return;
    lines[i] = m[1] + m[2] + m[3] + formatted + m[5];
    changed++;
  });
  return { text: lines.join(eol), changed };
}

/** Flatten a nested tuning object into { "group.name": number }. */
export function flattenTuning(obj: object, prefix = ''): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'number') out[path] = v;
    else if (v && typeof v === 'object') Object.assign(out, flattenTuning(v, path));
  }
  return out;
}

/** Copy every number from `src` into `dst`, keeping `dst` the same object (so live references stay valid). */
export function deepAssignNumbers(dst: object, src: object): void {
  for (const [k, v] of Object.entries(src)) {
    const d = dst as Record<string, unknown>;
    if (typeof v === 'number') d[k] = v;
    else if (v && typeof v === 'object') {
      if (!d[k] || typeof d[k] !== 'object') d[k] = {};
      deepAssignNumbers(d[k] as object, v);
    }
  }
}
