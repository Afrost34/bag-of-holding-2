/** A map point (as in geometry.ts, which imports the model, which imports this). */
interface Point {
  x: number;
  y: number;
}

/**
 * Map lettering: region names set along an arc ("THE  WHISPERING  WOODS" bent over a forest)
 * and routes drawn dashed or dotted. Pure geometry; the scene draws it.
 */

/** Where each letter goes: its centre, relative to the label's centre, and its turn (radians). */
export interface PlacedLetter extends Point {
  angle: number;
}

/**
 * Letters of the given widths laid out in a line `spacing` apart, then bent: `curve` from −100
 * (a bowl, ∪) to 100 (an arch, ∩); 100 bends the line into a half circle.
 */
export function arcLayout(
  widths: readonly number[],
  spacing: number,
  curve: number,
): PlacedLetter[] {
  const total = widths.reduce((n, w) => n + w, 0) + spacing * Math.max(0, widths.length - 1);
  // Arc length to each letter's middle, from the label's middle.
  let run = -total / 2;
  const along = widths.map((w) => {
    const s = run + w / 2;
    run += w + spacing;
    return s;
  });
  const bend = (Math.max(-100, Math.min(100, curve)) / 100) * Math.PI;
  if (Math.abs(bend) < 1e-6 || total === 0) return along.map((x) => ({ x, y: 0, angle: 0 }));
  const radius = total / Math.abs(bend);
  const sign = Math.sign(bend);
  // The middle of the line stays at y 0; the ends fall away (an arch) or rise (a bowl).
  return along.map((s) => {
    const phi = s / radius;
    return {
      x: radius * Math.sin(phi),
      y: sign * radius * (1 - Math.cos(phi)),
      angle: sign * phi,
    };
  });
}

export type RouteDash = 'dashed' | 'dotted';

/**
 * A polyline cut into dashes (`[x0, y0, x1, y1]` each) of `dash` length with `gap` between, the
 * pattern running on round corners.
 */
export function dashSegments(points: readonly number[], dash: number, gap: number): number[][] {
  const out: number[][] = [];
  let on = true;
  let left = dash;
  let current: number[] | null = null;
  for (let i = 0; i + 3 < points.length; i += 2) {
    let x = points[i] ?? 0;
    let y = points[i + 1] ?? 0;
    const tx = points[i + 2] ?? 0;
    const ty = points[i + 3] ?? 0;
    let length = Math.hypot(tx - x, ty - y);
    while (length > 0) {
      const step = Math.min(left, length);
      const nx = x + ((tx - x) * step) / length;
      const ny = y + ((ty - y) * step) / length;
      if (on) {
        current ??= [x, y];
        current.push(nx, ny);
      }
      left -= step;
      length -= step;
      x = nx;
      y = ny;
      if (left <= 1e-9) {
        if (on && current) out.push(current);
        current = null;
        on = !on;
        left = on ? dash : gap;
      }
    }
  }
  if (current && current.length >= 4) out.push(current);
  return out;
}

/** Points every `step` along a polyline, from its start: where a dotted route's dots go. */
export function dotsAlong(points: readonly number[], step: number): Point[] {
  const out: Point[] = [];
  let toNext = 0;
  for (let i = 0; i + 3 < points.length; i += 2) {
    const x = points[i] ?? 0;
    const y = points[i + 1] ?? 0;
    const dx = (points[i + 2] ?? 0) - x;
    const dy = (points[i + 3] ?? 0) - y;
    const length = Math.hypot(dx, dy);
    let at = toNext;
    for (; at <= length; at += step)
      out.push({ x: x + (dx * at) / length, y: y + (dy * at) / length });
    toNext = at - length;
  }
  return out;
}
