/**
 * PLATFORM LAYER: room links in the page address.
 * A shared link looks like  https://your-site/?room=ABCDE
 * (A desktop build would replace this with its own way of passing room codes.)
 */

/** The room code in the current page address, if any. */
export function roomFromUrl(): string | null {
  const code = new URLSearchParams(window.location.search).get('room');
  return code ? code.toUpperCase() : null;
}

/** A link a friend can open to join this room. */
export function shareLink(code: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', code);
  return url.toString();
}

/** Remove ?room=... from the address bar (so refreshing doesn't rejoin). */
export function clearRoomFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('room')) return;
  url.searchParams.delete('room');
  window.history.replaceState(null, '', url.toString());
}

/** Copy text to the clipboard. Resolves false if the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
