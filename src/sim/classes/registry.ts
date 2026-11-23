/**
 * The list of playable classes. To add a class: make a folder like ./mage/,
 * then add it to CLASSES below.
 */
import type { ClassDef, PlaceableKindDef } from '../abilities.ts';
import { MAGE } from './mage/index.ts';

export const CLASSES: Record<string, ClassDef> = {
  mage: MAGE,
};

export function getClass(id: string): ClassDef | undefined {
  return CLASSES[id];
}

export function getPlaceableKind(kind: string): PlaceableKindDef | undefined {
  for (const c of Object.values(CLASSES)) {
    const k = c.placeables.find((p) => p.kind === kind);
    if (k) return k;
  }
  return undefined;
}
