/**
 * Loads every sprite listed in config/assets.ts.
 * Starts with the code-drawn placeholder, then swaps in public/art/<file> if it exists.
 */
import { SPRITES, type SpriteId } from '../config/assets.ts';
import { PLACEHOLDERS } from './placeholders.ts';

export interface Sprite {
  image: CanvasImageSource;
  size: number; // drawn size in world units (from the asset map)
  aspect: number; // height / width of the image
}

const sprites = new Map<SpriteId, Sprite>();

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
}

export function getSprite(id: SpriteId): Sprite {
  return sprites.get(id)!;
}

/** Look up a sprite by a name coming from the simulation (which only knows plain strings). */
export function findSprite(name: string): Sprite | undefined {
  return sprites.get(name as SpriteId);
}
