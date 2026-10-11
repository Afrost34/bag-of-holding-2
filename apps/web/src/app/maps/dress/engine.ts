import type { DressRule } from '../model';
import { pointInPolygon } from '../polygon';
import {
  blocked,
  pickIndex,
  randomAngle,
  scatterInstances,
  type Instance,
  type Obstacles,
  type ScatterSpec,
} from '../scatter';
import { bounds, nearestOnPolyline } from '../spline';
import { seeded } from '../terrain';
import { faintTint } from '../randomize';

/**
 * The dress engine: the pieces of a dressing, rule by rule. Each rule places its pieces by
 * `place` (fill the area, follow the line, keep near the edge, clumps, rows), then thins them
 * towards the edge (`falloff`), snaps them to the grid, keeps them clear of earlier rules'
 * pieces (`apart`), and mirrors and tints them a little. Pure: the same item gives the same
 * pieces.
 */

export interface DressInstance extends Instance {
  /** Which rule placed it (an index into the item's rules); `piece` indexes that rule's pieces. */
  rule: number;
  flip?: boolean;
  tint?: string;
}

/** Where a dressing goes and what it keeps clear of, worked out from the map once for all rules. */
export interface DressTarget {
  /** Area: the outline; along: the line (rounded, map pixels). */
  line: readonly number[];
  mode: 'area' | 'along';
  seed: number;
  obstacles: Obstacles;
  allowed: (x: number, y: number) => boolean;
  clearance: number;
  /** The grid's cell, for `snap`. */
  cell: number;
  /** Half the width of a piece on the map (pack pictures take theirs from their name); half its size when absent. */
  reach?: (rule: DressRule, piece: Instance) => number;
}

/** Most pieces a rule makes, so a huge area stays quick. */
const MAX_PIECES = 6000;

/** A rule's seed: the first rule uses the item's own, so dressings made before rules look the same. */
export const ruleSeed = (seed: number, rule: number): number => seed + rule * 7919;

function specOf(rule: DressRule, target: DressTarget, r: number): ScatterSpec {
  return {
    mode: 'area',
    line: target.line,
    seed: ruleSeed(target.seed, r),
    // Overlap shrinks the room each piece keeps round it (a packed forest, a crowd).
    spacing: Math.max(2, rule.spacing * (1 - (rule.overlap ?? 0))),
    sizeMin: rule.sizeMin,
    sizeMax: rule.sizeMax,
    weights: rule.pieces.map((p) => p.weight),
    rotation: rule.rotation,
    rotMin: rule.rotMin,
    rotMax: rule.rotMax,
    cluster: rule.cluster,
    offset: rule.offset,
    sides: rule.sides,
    jitter: rule.jitter,
    clearance: target.clearance,
    max: MAX_PIECES,
  };
}

/** How a piece placed on its own (clumps, rows) is turned. */
function turn(rule: DressRule, rand: () => number): number {
  if (rule.rotation === 'random') return randomAngle(rand, rule);
  if (rule.rotation === 'quarter') return Math.floor(rand() * 4) * (Math.PI / 2);
  return 0;
}

const closed = (line: readonly number[]): number[] =>
  line.length >= 4 ? [...line, line[0] ?? 0, line[1] ?? 0] : [...line];

/** How far a point is from the edge of an outline. */
const edgeDistance = (outline: readonly number[], x: number, y: number): number =>
  nearestOnPolyline(closed(outline), { x, y }).dist;

/** The pieces one rule places, before thinning, snapping and keeping apart. */
function placeRule(rule: DressRule, target: DressTarget, r: number): Instance[] {
  const spec = specOf(rule, target, r);
  const okAt = (x: number, y: number) =>
    target.allowed(x, y) && !blocked(x, y, target.obstacles, target.clearance);
  const inside = (x: number, y: number) =>
    target.mode === 'along' || pointInPolygon({ x, y }, target.line);
  switch (rule.place) {
    case 'along': {
      // Along an area's edge: its outline as a closed line.
      const line = target.mode === 'area' ? closed(target.line) : target.line;
      return scatterInstances({ ...spec, mode: 'along', line }, target.obstacles, target.allowed);
    }
    case 'edge': {
      if (target.mode === 'along') return [];
      const depth = rule.depth ?? rule.spacing * 2;
      return scatterInstances(spec, target.obstacles, target.allowed).filter(
        (p) => edgeDistance(target.line, p.x, p.y) <= depth,
      );
    }
    case 'cluster': {
      if (target.mode === 'along') return [];
      const rand = seeded(spec.seed ^ 0x5bd1e995);
      const centres = scatterInstances(
        { ...spec, spacing: spec.spacing * 3.5, weights: [1], cluster: 0 },
        target.obstacles,
        target.allowed,
      );
      const out: Instance[] = [];
      for (const c of centres) {
        const count = 3 + Math.floor(rand() * 5);
        for (let k = 0; k < count && out.length < MAX_PIECES; k++) {
          const a = rand() * Math.PI * 2;
          const d = k === 0 ? 0 : spec.spacing * (0.5 + rand() * 0.8);
          const x = c.x + Math.cos(a) * d;
          const y = c.y + Math.sin(a) * d;
          const size = rule.sizeMin + rand() * Math.max(0, rule.sizeMax - rule.sizeMin);
          const piece = pickIndex(spec.weights, rand());
          const angle = turn(rule, rand);
          if (inside(x, y) && okAt(x, y)) out.push({ x, y, angle, size, piece });
        }
      }
      return out;
    }
    case 'grid': {
      if (target.mode === 'along') return [];
      const rand = seeded(spec.seed ^ 0x27d4eb2f);
      const b = bounds(target.line);
      const step = Math.max(4, rule.spacing);
      const out: Instance[] = [];
      for (let y = b.y0 + step / 2; y <= b.y1 && out.length < MAX_PIECES; y += step)
        for (let x = b.x0 + step / 2; x <= b.x1 && out.length < MAX_PIECES; x += step) {
          const px = x + (rand() * 2 - 1) * rule.jitter * step * 0.5;
          const py = y + (rand() * 2 - 1) * rule.jitter * step * 0.5;
          const size = rule.sizeMin + rand() * Math.max(0, rule.sizeMax - rule.sizeMin);
          const piece = pickIndex(spec.weights, rand());
          const angle = turn(rule, rand);
          if (inside(px, py) && okAt(px, py)) out.push({ x: px, y: py, angle, size, piece });
        }
      return out;
    }
    default:
      return scatterInstances(spec, target.obstacles, target.allowed);
  }
}

/** The pieces of every rule, in rule order, each rule's back to front. */
export function dressPieces(rules: readonly DressRule[], target: DressTarget): DressInstance[] {
  const out: DressInstance[] = [];
  rules.forEach((rule, r) => {
    if (rule.pieces.length === 0 || target.line.length < 4) return;
    const rand = seeded(ruleSeed(target.seed, r) ^ 0x68e31da4);
    let list = placeRule(rule, target, r);
    if (rule.falloff && rule.falloff > 0) {
      const reach = rule.falloff * rule.spacing * 4;
      list = list.filter((p) => {
        const d =
          target.mode === 'area'
            ? edgeDistance(target.line, p.x, p.y)
            : (() => {
                const near = nearestOnPolyline(target.line, p);
                return Math.min(near.t, 1 - near.t) * lineLength(target.line);
              })();
        return d >= reach || rand() < d / reach;
      });
    }
    if (rule.snap && rule.snap > 0) {
      const step = target.cell / rule.snap;
      const taken = new Set<string>();
      list = list.flatMap((p) => {
        const cx = Math.floor(p.x / step);
        const cy = Math.floor(p.y / step);
        const key = `${String(cx)},${String(cy)}`;
        if (taken.has(key)) return [];
        taken.add(key);
        return [{ ...p, x: (cx + 0.5) * step, y: (cy + 0.5) * step }];
      });
    }
    if (rule.apart && out.length > 0) {
      const reach = target.reach ?? ((_rule: DressRule, p: Instance) => p.size / 2);
      const earlier = out.flatMap((o) => {
        const of = rules[o.rule];
        return of ? [{ x: o.x, y: o.y, r: reach(of, o) }] : [];
      });
      // A piece may tuck under the edge of an earlier one, never sit in its middle.
      list = list.filter((p) => {
        const mine = reach(rule, p) * 0.5;
        return earlier.every((o) => Math.hypot(o.x - p.x, o.y - p.y) >= o.r * 0.85 + mine);
      });
    }
    const placed = list
      .map((p): DressInstance => {
        const inst: DressInstance = { ...p, rule: r };
        if (rule.flip && rand() < 0.5) inst.flip = true;
        if (rule.tint && rule.tint > 0 && rand() < rule.tint) inst.tint = faintTint(rand(), rand());
        return inst;
      })
      .sort((a, b) => a.y - b.y);
    out.push(...placed);
  });
  return out;
}

function lineLength(line: readonly number[]): number {
  let total = 0;
  for (let i = 2; i + 1 < line.length; i += 2)
    total += Math.hypot(
      (line[i] ?? 0) - (line[i - 2] ?? 0),
      (line[i + 1] ?? 0) - (line[i - 1] ?? 0),
    );
  return total;
}
