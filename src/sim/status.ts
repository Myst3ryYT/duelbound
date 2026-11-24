/**
 * Status effects that work the same for every class:
 * timers counting down, and being dragged towards someone (Sheriff's lasso).
 */
import type { Fighter, World } from './types.ts';
import { dist } from './math.ts';

export function tickStatusTimers(f: Fighter, dt: number): void {
  f.rootedT = Math.max(0, f.rootedT - dt);
  f.stunT = Math.max(0, f.stunT - dt);
  f.invulnT = Math.max(0, f.invulnT - dt);
}

/** Hitstun counts down at the END of each tick (after everyone has acted), so it always freezes whole ticks. */
export function tickHitstun(f: Fighter, dt: number): void {
  f.hitstunT = Math.max(0, f.hitstunT - dt);
}

/**
 * Hitstun: freeze a fighter for a couple of ticks after a big hit (no moving, no abilities).
 * `frames` is in ticks (1 frame = 1/60 s). Frame counts live in tuning.hitstun.
 */
export function applyHitstun(f: Fighter, frames: number, tickRate: number): void {
  if (frames > 0) f.hitstunT = Math.max(f.hitstunT, frames / tickRate);
}

/** Start dragging `target` towards `puller`. */
export function startPull(target: Fighter, puller: Fighter, speed: number, maxTime: number): void {
  target.pullById = puller.id;
  target.pullT = maxTime;
  target.vars.pullSpeed = speed;
  target.vars.pullLastX = NaN; // no "stuck" check until the first drag step
  target.vars.pullLastY = NaN;
}

/**
 * Move a dragged fighter towards whoever is pulling it. The pull ends when it
 * arrives, when time runs out, or when it gets stuck on a structure.
 */
export function updatePull(world: World, f: Fighter, dt: number): void {
  if (!f.pullById) return;
  const puller = world.fighters.find((p) => p.id === f.pullById);
  f.pullT -= dt;
  if (!puller || f.pullT <= 0) {
    f.pullById = 0;
    return;
  }
  const d = dist(f.x, f.y, puller.x, puller.y);
  const stopAt = f.radius + puller.radius + 6;
  if (d <= stopAt) {
    f.pullById = 0;
    return;
  }
  const step = Math.min(f.vars.pullSpeed * dt, d - stopAt);
  const beforeX = f.x;
  const beforeY = f.y;
  f.x += ((puller.x - f.x) / d) * step;
  f.y += ((puller.y - f.y) / d) * step;
  f.vars.pullLastX = beforeX;
  f.vars.pullLastY = beforeY;
}

/** After collisions: if a structure stopped the drag, let go. */
export function checkPullStuck(f: Fighter, dt: number): void {
  if (!f.pullById) return;
  const moved = dist(f.x, f.y, f.vars.pullLastX, f.vars.pullLastY);
  if (moved < f.vars.pullSpeed * dt * 0.2) f.pullById = 0;
}
