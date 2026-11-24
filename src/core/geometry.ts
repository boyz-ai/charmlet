export interface Pt { x: number; y: number }

/** Gap half-width: a ring's gap covers a point within ±28°. */
export const GAP = (28 * Math.PI) / 180;
/** A drag counts as one move when the ring turned more than this (radians, ≈8°). */
export const MOVE_THRESHOLD = 0.14;

/** Smallest absolute difference between two angles (radians). */
export const angDiff = (a: number, b: number): number =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** Signed shortest delta from a to b. */
export const angDelta = (a: number, b: number): number => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export const angleOf = (c: Pt, p: Pt): number => Math.atan2(p.y - c.y, p.x - c.x);

/** Intersection points of two circles, or null if they don't cross. */
export function circleIntersections(a: Pt & { r: number }, b: Pt & { r: number }): [Pt, Pt] | null {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  if (d >= a.r + b.r || d <= Math.abs(a.r - b.r)) return null;
  const l = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const h = Math.sqrt(a.r * a.r - l * l);
  const mx = a.x + (dx * l) / d, my = a.y + (dy * l) / d;
  return [
    { x: mx + (h * dy) / d, y: my - (h * dx) / d },
    { x: mx - (h * dy) / d, y: my + (h * dx) / d },
  ];
}
