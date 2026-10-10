import type { TerrainRef } from './terrain';

/**
 * Dungeondraft's terrain: up to eight textures ("slots") painted with a soft brush, each stroke
 * covering what was under it, edges blending into each other. The map keeps the *strokes* (an
 * ordered log) and the picture is rebuilt from them, so undo, sync and moving a map need nothing
 * new. Pure; drawing is in `splatView.ts`.
 */

export const MAX_SLOTS = 8;

export interface SplatStroke {
  /** The slot painted (`erase`: the paint taken off, whatever the slot). */
  slot: number;
  /** x0, y0, x1, y1… in map pixels. */
  points: number[];
  /** Brush radius, map pixels. */
  radius: number;
  /** 0 = very soft edge, 1 = hard edge. */
  hardness: number;
  erase?: boolean;
  /** Covers the whole map with the slot (the Fill button): no points. */
  fill?: boolean;
}

export interface Splat {
  /** The textures of the slots, in order (at most `MAX_SLOTS`). */
  slots: TerrainRef[];
  strokes: SplatStroke[];
}

export const DEFAULT_SLOTS: TerrainRef[] = ['grass', 'dirt', 'sand', 'water'];

export const emptySplat = (): Splat => ({ slots: [...DEFAULT_SLOTS], strokes: [] });

/** The splat with a stroke at the end. */
export const addSplatStroke = (splat: Splat | undefined, stroke: SplatStroke): Splat => {
  const base = splat ?? emptySplat();
  return { ...base, strokes: [...base.strokes, stroke] };
};

/** The splat with a slot's texture changed (and the slot made if it is the next one). */
export function setSplatSlot(splat: Splat | undefined, slot: number, texture: TerrainRef): Splat {
  const base = splat ?? emptySplat();
  if (slot < 0 || slot >= MAX_SLOTS || slot > base.slots.length) return base;
  const slots = [...base.slots];
  slots[slot] = texture;
  return { ...base, slots };
}

/** The splat with the whole map covered by one slot. */
export const fillSplat = (splat: Splat | undefined, slot: number): Splat =>
  addSplatStroke(splat, { slot, points: [], radius: 0, hardness: 1, fill: true });

/**
 * Points along a stroke, close enough that the brush's dabs overlap into a continuous line:
 * at most a quarter of the radius apart.
 */
export function dabPoints(points: readonly number[], radius: number): { x: number; y: number }[] {
  const step = Math.max(1, radius / 4);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = points[i] ?? 0;
    const y = points[i + 1] ?? 0;
    const px = points[i - 2];
    const py = points[i - 1];
    if (px === undefined || py === undefined) {
      out.push({ x, y });
      continue;
    }
    const d = Math.hypot(x - px, y - py);
    const n = Math.max(1, Math.ceil(d / step));
    for (let k = 1; k <= n; k++)
      out.push({ x: px + ((x - px) * k) / n, y: py + ((y - py) * k) / n });
  }
  return out;
}

/** Splat read from a file: bad parts are dropped. */
export function parseSplat(raw: unknown): Splat | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as { slots?: unknown; strokes?: unknown };
  const slots = (Array.isArray(r.slots) ? r.slots : [])
    .filter((s): s is TerrainRef => typeof s === 'string')
    .slice(0, MAX_SLOTS);
  if (slots.length === 0) return undefined;
  const strokes = (Array.isArray(r.strokes) ? r.strokes : []).flatMap((s): SplatStroke[] => {
    if (typeof s !== 'object' || s === null) return [];
    const o = s as Record<string, unknown>;
    const slot = Number(o.slot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= slots.length) return [];
    const points = Array.isArray(o.points)
      ? o.points.filter((n): n is number => typeof n === 'number')
      : [];
    const fill = o.fill === true;
    if (!fill && points.length < 2) return [];
    return [
      {
        slot,
        points,
        radius: Math.max(1, Number(o.radius) || 40),
        hardness: Math.min(1, Math.max(0, Number(o.hardness) || 0)),
        ...(o.erase === true ? { erase: true } : {}),
        ...(fill ? { fill: true } : {}),
      },
    ];
  });
  return { slots, strokes };
}
