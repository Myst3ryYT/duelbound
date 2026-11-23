/** Helpers for abilities to report sounds and visual effects (the sim never plays or draws them itself). */
import type { World } from './types.ts';

export function emitSound(world: World, sound: string, x: number, y: number): void {
  world.events.push({ type: 'sound', sound, x, y });
}

export function emitFx(world: World, fx: 'ring' | 'burst', x: number, y: number, color: string, radius: number, duration: number): void {
  world.events.push({ type: 'fx', fx, x, y, color, radius, duration });
}
