/** Small maths helpers used by the simulation. */

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** Distance between two points. */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  return length(bx - ax, by - ay);
}
