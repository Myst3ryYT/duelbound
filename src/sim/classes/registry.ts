/**
 * The list of playable classes. To add a class: make a folder like ./mage/,
 * then add it to CLASSES below.
 */
import type { ClassDef, ObjectKindDef, PlaceableKindDef, ProjectileHook } from '../abilities.ts';
import { MAGE } from './mage/index.ts';
import { SHERIFF } from './sheriff/index.ts';
import { REFRACTOR } from './refractor/index.ts';

export const CLASSES: Record<string, ClassDef> = {
  mage: MAGE,
  sheriff: SHERIFF,
  refractor: REFRACTOR,
};

/** Class ids in menu order. */
export const CLASS_ORDER = Object.keys(CLASSES);

export function getClass(id: string): ClassDef | undefined {
  return CLASSES[id];
}

export function getPlaceableKind(kind: string): PlaceableKindDef | undefined {
  for (const c of Object.values(CLASSES)) {
    const k = c.placeables?.find((p) => p.kind === kind);
    if (k) return k;
  }
  return undefined;
}

export function getObjectKind(kind: string): ObjectKindDef | undefined {
  for (const c of Object.values(CLASSES)) {
    const k = c.objects?.find((o) => o.kind === kind);
    if (k) return k;
  }
  return undefined;
}

export function getProjectileHook(behavior: string): ProjectileHook | undefined {
  if (!behavior) return undefined;
  for (const c of Object.values(CLASSES)) {
    const h = c.projectileHooks?.[behavior];
    if (h) return h;
  }
  return undefined;
}
