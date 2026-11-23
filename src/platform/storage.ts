/**
 * PLATFORM LAYER: saving small settings.
 *
 * All browser-only services (localStorage now; URLs and PeerJS later) live in
 * src/platform/, so a desktop build only needs to replace these few files.
 */
const PREFIX = 'rebound.';

export function loadSetting<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function saveSetting<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or blocked: settings just won't be remembered
  }
}
