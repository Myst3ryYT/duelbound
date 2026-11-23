/** Small maths helpers used by the simulation. */

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** Distance between two points. */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  return length(bx - ax, by - ay);
}

/**
 * Does a moving point, travelling from A to B this tick, touch a circle?
 * Returns how far along the path (0..1) it first touches, or -1 for a miss.
 * Checking the whole path (not just the end point) stops fast shots skipping through things.
 */
export function segmentCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const fx = ax - cx;
  const fy = ay - cy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0; // already inside
  const a = dx * dx + dy * dy;
  if (a === 0) return -1;
  const b = 2 * (fx * dx + fy * dy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

/** The closest point to (px, py) on the line segment from (ax, ay) to (bx, by). */
export function closestOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): { x: number; y: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0;
  return { x: ax + dx * t, y: ay + dy * t };
}

/** Distance from a point to a line segment. */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const c = closestOnSegment(px, py, ax, ay, bx, by);
  return dist(px, py, c.x, c.y);
}

/** Where (0..1 along A->B) two segments A-B and C-D cross, or -1 if they don't. */
export function segmentIntersect(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  const rx = bx - ax;
  const ry = by - ay;
  const sx = dx - cx;
  const sy = dy - cy;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return -1; // parallel
  const t = ((cx - ax) * sy - (cy - ay) * sx) / denom;
  const u = ((cx - ax) * ry - (cy - ay) * rx) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
}

/** Shortest distance between two line segments. */
export function segmentSegmentDistance(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  if (segmentIntersect(ax, ay, bx, by, cx, cy, dx, dy) >= 0) return 0;
  return Math.min(
    distToSegment(ax, ay, cx, cy, dx, dy),
    distToSegment(bx, by, cx, cy, dx, dy),
    distToSegment(cx, cy, ax, ay, bx, by),
    distToSegment(dx, dy, ax, ay, bx, by),
  );
}

/**
 * Does a point moving from A to B touch a "capsule" (the segment C-D thickened by r)?
 * Returns how far along the path (0..1) it first touches, or -1 for a miss.
 */
export function segmentCapsule(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number, r: number): number {
  if (distToSegment(ax, ay, cx, cy, dx, dy) <= r) return 0; // already touching
  const len = dist(cx, cy, dx, dy) || 1;
  const nx = (-(dy - cy) / len) * r; // offset to each side of the segment
  const ny = ((dx - cx) / len) * r;
  let best = -1;
  const consider = (t: number) => {
    if (t >= 0 && (best < 0 || t < best)) best = t;
  };
  consider(segmentIntersect(ax, ay, bx, by, cx + nx, cy + ny, dx + nx, dy + ny));
  consider(segmentIntersect(ax, ay, bx, by, cx - nx, cy - ny, dx - nx, dy - ny));
  consider(segmentCircle(ax, ay, bx, by, cx, cy, r));
  consider(segmentCircle(ax, ay, bx, by, dx, dy, r));
  return best;
}
