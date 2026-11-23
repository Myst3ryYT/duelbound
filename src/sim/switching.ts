/**
 * Mage's Switch: anything moving slows to a stop in a straight line, then
 * speeds back up the opposite way, reaching full speed after `turnTime` seconds.
 */
import type { Switchable } from './types.ts';

export function startSwitch(s: Switchable, turnTime: number): void {
  if (turnTime <= 0) {
    s.vx = -s.vx;
    s.vy = -s.vy;
    return;
  }
  s.switchVx = s.vx;
  s.switchVy = s.vy;
  s.switchT = turnTime;
  s.switchTotal = turnTime;
}

/** Call once per tick on anything that might be switching. */
export function updateSwitch(s: Switchable, dt: number): void {
  if (s.switchT <= 0) return;
  s.switchT = Math.max(0, s.switchT - dt);
  const k = 1 - s.switchT / s.switchTotal; // 0 -> 1 over the turn
  const factor = 1 - 2 * k; // 1 (full speed forwards) -> 0 (stopped) -> -1 (full speed backwards)
  s.vx = s.switchVx * factor;
  s.vy = s.switchVy * factor;
}

/** Stop a turn-around early (e.g. the projectile got reflected). */
export function cancelSwitch(s: Switchable): void {
  s.switchT = 0;
}
