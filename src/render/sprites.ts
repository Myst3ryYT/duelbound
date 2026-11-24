/**
 * Loads every sprite listed in config/assets.ts.
 * Starts with the code-drawn placeholder, then swaps in public/art/<file> if it exists.
 */
import { ART_PIXEL, SHEETS, SPRITES, type SpriteId } from '../config/assets.ts';
import { PLACEHOLDERS } from './placeholders.ts';

export interface Sprite {
  image: CanvasImageSource;
  size: number; // drawn size in world units (from the asset map)
  aspect: number; // height / width of the image
}

const sprites = new Map<SpriteId, Sprite>();

/** The three facings of a sprite-sheet character. */
export interface Facings {
  front: Sprite; // aiming down
  side: Sprite; // aiming right (flip it for left)
  back: Sprite; // aiming up
}
const facings = new Map<string, Facings>();

/** Cut a sheet into its frames. */
function loadSheets(): void {
  for (const id of Object.keys(SHEETS) as (keyof typeof SHEETS)[]) {
    const entry = SHEETS[id];
    const img = new Image();
    img.onload = () => {
      const fw = img.naturalWidth / entry.frames;
      const frames: Sprite[] = [];
      for (let i = 0; i < entry.frames; i++) {
        const c = document.createElement('canvas');
        c.width = fw;
        c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, i * fw, 0, fw, img.naturalHeight, 0, 0, fw, img.naturalHeight);
        // Drawn size: whole art pixels, so every art pixel is the same size on screen.
        frames.push({ image: c, size: fw * ART_PIXEL, aspect: img.naturalHeight / fw });
      }
      facings.set(id, { front: frames[0], side: frames[1], back: frames[2] });
      sprites.set(id, frames[0]); // menus show the front view
    };
    img.onerror = () => {}; // no sheet: keep the placeholder
    img.src = `${import.meta.env.BASE_URL}art/${entry.file}`;
  }
}

/** The facing frames for a sprite id, if it comes from a sheet. */
export function getFacings(id: string): Facings | undefined {
  return facings.get(id);
}

export function loadSprites(): void {
  for (const id of Object.keys(SPRITES) as SpriteId[]) {
    const entry = SPRITES[id];
    const placeholder = PLACEHOLDERS[id]();
    sprites.set(id, { image: placeholder, size: entry.size, aspect: placeholder.height / placeholder.width });

    const img = new Image();
    img.onload = () => {
      sprites.set(id, { image: img, size: entry.size, aspect: img.naturalHeight / img.naturalWidth });
    };
    img.onerror = () => {}; // no custom art: keep the placeholder
    img.src = `${import.meta.env.BASE_URL}art/${entry.file}`;
  }
  loadSheets();
}

export function getSprite(id: SpriteId): Sprite {
  return sprites.get(id)!;
}

/** Look up a sprite by a name coming from the simulation (which only knows plain strings). */
export function findSprite(name: string): Sprite | undefined {
  return sprites.get(name as SpriteId);
}
