/** Turns key codes from config/keybinds.ts into short labels for on-screen hints. */
const SPECIAL: Record<string, string> = {
  Mouse0: 'LMB',
  Mouse1: 'MMB',
  Mouse2: 'RMB',
  Escape: 'Esc',
  Backquote: '`',
  Space: 'Space',
  ShiftLeft: 'Shift',
  ControlLeft: 'Ctrl',
  AltLeft: 'Alt',
};

export function keyLabel(code: string | undefined): string {
  if (!code) return '?';
  if (SPECIAL[code]) return SPECIAL[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}
