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
import { keepInBand, type Ground } from './ground';
import { faceTowards, INTERIOR_PLACES, placeInterior, type Placed } from './interior';

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
  /** The width and height of a piece on the map; a square of its size when absent. */
  box?: (rule: DressRule, piece: Instance) => { w: number; h: number };
  /** Doorways of the room a dressing furnishes: kept clear. */
  doors?: readonly { x: number; y: number }[];
  /** How high and steep the ground is (the map's elevation), for rules with a `height` or `slope`. */
  ground?: Ground;
}

/** Most pieces a rule makes, so a huge area stays quick. */
const MAX_PIECES = 6000;

/** Places that relate to an earlier rule's pieces anywhere (not only in a room); `count` is per anchor. */
export const ANCHORED_OUTSIDE = new Set<DressRule['place']>(['ring', 'front']);

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

/** The width and height of a piece: from the target (pack sizes), else a square of its size. */
const boxSize = (target: DressTarget, rule: DressRule, p: Instance) =>
  target.box ? target.box(rule, p) : { w: p.size, h: p.size };

/**
 * Pieces in a ring round each piece of the anchor rule (logs and bedrolls round a fire, stones in
 * a circle round an altar): evenly spread from a random start, `offset` out from the anchor's
 * edge, as many as fit at `spacing` (at most `count` each). Turned `along` they face the anchor
 * (FA pictures face down, so the bottom of the picture points at it).
 */
function ringRule(
  rule: DressRule,
  target: DressTarget,
  r: number,
  anchors: readonly Placed[],
): Instance[] {
  const rand = seeded(ruleSeed(target.seed, r) ^ 0x3c6ef372);
  const weights = rule.pieces.map((p) => p.weight);
  const inside = (x: number, y: number) =>
    target.mode === 'along' || pointInPolygon({ x, y }, target.line);
  const out: Instance[] = [];
  for (const a of anchors) {
    const ax = a.box.x;
    const ay = a.box.y;
    const middle = Math.max(a.box.w, a.box.h) / 2;
    const probe = boxSize(target, rule, {
      x: 0,
      y: 0,
      angle: 0,
      size: (rule.sizeMin + rule.sizeMax) / 2,
      piece: 0,
    });
    const radius = middle + Math.max(0, rule.offset) + probe.h / 2;
    const fit = Math.max(
      1,
      Math.floor((2 * Math.PI * radius) / Math.max(4, rule.spacing, probe.w * 1.05)),
    );
    const n = Math.min(fit, rule.count ?? fit);
    const start = rand() * Math.PI * 2;
    for (let k = 0; k < n && out.length < MAX_PIECES; k++) {
      const theta = start + (k * Math.PI * 2) / n + (rand() * 2 - 1) * rule.jitter * (Math.PI / n);
      const reach = radius * (1 + (rand() * 2 - 1) * rule.jitter * 0.15);
      const x = ax + Math.cos(theta) * reach;
      const y = ay + Math.sin(theta) * reach;
      const size = rule.sizeMin + rand() * Math.max(0, rule.sizeMax - rule.sizeMin);
      const piece = pickIndex(weights, rand());
      const angle =
        rule.rotation === 'along'
          ? faceTowards(ax - x, ay - y) + ((rand() * 2 - 1) * ((rule.loose ?? 0) * Math.PI)) / 180
          : turn(rule, rand);
      if (
        inside(x, y) &&
        ownAnchor(x, y, a, anchors) &&
        target.allowed(x, y) &&
        !blocked(x, y, target.obstacles, target.clearance)
      )
        out.push({ x, y, angle, size, piece });
    }
  }
  return out;
}

/**
 * One piece in front of each piece of the anchor rule, turned as it is (a grave mound before its
 * tombstone, goods laid out before a stall): FA pictures face down, so "in front" is towards the
 * bottom of the anchor's picture, `offset` beyond its edge. `fill` is the share of anchors that
 * get one.
 */
function frontRule(
  rule: DressRule,
  target: DressTarget,
  r: number,
  anchors: readonly Placed[],
): Instance[] {
  const rand = seeded(ruleSeed(target.seed, r) ^ 0x7f4a7c15);
  const weights = rule.pieces.map((p) => p.weight);
  const share = rule.fill ?? 1;
  const out: Instance[] = [];
  for (const a of anchors) {
    const keep = rand() < share;
    const size = rule.sizeMin + rand() * Math.max(0, rule.sizeMax - rule.sizeMin);
    const piece = pickIndex(weights, rand());
    if (!keep) continue;
    const mine = boxSize(target, rule, { x: 0, y: 0, angle: 0, size, piece });
    const fx = -Math.sin(a.box.angle);
    const fy = Math.cos(a.box.angle);
    const d = a.box.h / 2 + Math.max(0, rule.offset) + mine.h / 2;
    const x = a.box.x + fx * d;
    const y = a.box.y + fy * d;
    const loose = ((rand() * 2 - 1) * (rule.loose ?? 0) * Math.PI) / 180;
    if (
      ownAnchor(x, y, a, anchors) &&
      target.allowed(x, y) &&
      !blocked(x, y, target.obstacles, target.clearance)
    )
      out.push({ x, y, angle: a.box.angle + loose, size, piece });
  }
  return out;
}

/**
 * Whether a piece placed for one anchor is nearer that anchor than any other: pieces of a ring or
 * in front never crowd a neighbouring fire or the next row of stones.
 */
function ownAnchor(x: number, y: number, own: Placed, anchors: readonly Placed[]): boolean {
  const mine = Math.hypot(own.box.x - x, own.box.y - y);
  return anchors.every((a) => a === own || Math.hypot(a.box.x - x, a.box.y - y) >= mine);
}

/** The middle of where a dressing goes: the average of its outline's corners, or of its line. */
function middleOf(line: readonly number[]): { x: number; y: number } {
  const n = Math.max(1, Math.floor(line.length / 2));
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < line.length; i += 2) {
    x += line[i] ?? 0;
    y += line[i + 1] ?? 0;
  }
  return { x: x / n, y: y / n };
}

/** Keeps the pieces of a rule with a `height` or `slope` band to that ground (soft at the ends). */
function onItsGround(
  rule: DressRule,
  list: Instance[],
  ground: Ground | undefined,
  rand: () => number,
): Instance[] {
  if (!ground || (!rule.height && !rule.slope)) return list;
  return list.filter((p) => {
    const g = ground(p.x, p.y);
    return (
      (!rule.height || keepInBand(g.height, rule.height, rand())) &&
      (!rule.slope || keepInBand(g.slope, rule.slope, rand()))
    );
  });
}

/** The pieces of every rule, in rule order, each rule's back to front. */
export function dressPieces(rules: readonly DressRule[], target: DressTarget): DressInstance[] {
  const out: DressInstance[] = [];
  // Every rule's pieces as boxes, by rule: interior rules keep clear of them and anchor to them.
  const boxes: Placed[][] = [];
  rules.forEach((rule, r) => {
    if (rule.pieces.length === 0 || target.line.length < 4) {
      boxes.push([]);
      return;
    }
    const rand = seeded(ruleSeed(target.seed, r) ^ 0x68e31da4);
    if (INTERIOR_PLACES.has(rule.place)) {
      const placed =
        target.mode === 'area'
          ? placeInterior(
              rule,
              {
                outline: target.line,
                doors: target.doors ?? [],
                cell: target.cell,
                rand: seeded(ruleSeed(target.seed, r) ^ 0x1b873593),
                boxOf: (rl, piece, size) =>
                  boxSize(target, rl, { x: 0, y: 0, angle: 0, size, piece }),
                placed: boxes,
              },
              rules,
            )
          : [];
      boxes.push(rule.floor ? placed.map((p) => ({ ...p, soft: true })) : placed);
      out.push(
        ...placed.map(({ inst }): DressInstance => {
          const d: DressInstance = { ...inst, angle: inst.angle + turnOf(rule), rule: r };
          if (rule.flip && rand() < 0.5) d.flip = true;
          if (rule.tint && rule.tint > 0 && rand() < rule.tint) d.tint = faintTint(rand(), rand());
          return d;
        }),
      );
      return;
    }
    const anchors = rule.anchor !== undefined ? (boxes[rule.anchor] ?? []) : [];
    let list =
      rule.place === 'ring'
        ? ringRule(rule, target, r, anchors)
        : rule.place === 'front'
          ? frontRule(rule, target, r, anchors)
          : placeRule(rule, target, r);
    list = onItsGround(rule, list, target.ground, rand);
    // In a room the floor reaches the walls: scattered pieces keep most of themselves inside it.
    if (target.doors !== undefined && target.mode === 'area') {
      const reach = target.reach ?? ((_rule: DressRule, p: Instance) => p.size / 2);
      list = list.filter((p) => edgeDistance(target.line, p.x, p.y) >= reach(rule, p) * 0.7);
    }
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
    // A few pieces of a scattered rule: those nearest the middle (an altar, a well in the square).
    if (rule.count !== undefined && !ANCHORED_OUTSIDE.has(rule.place) && list.length > rule.count) {
      const mid = middleOf(target.line);
      list = [...list]
        .sort((a, b) => Math.hypot(a.x - mid.x, a.y - mid.y) - Math.hypot(b.x - mid.x, b.y - mid.y))
        .slice(0, rule.count);
    }
    const placed = list
      .map((p): DressInstance => {
        const inst: DressInstance = { ...p, angle: p.angle + turnOf(rule), rule: r };
        if (rule.flip && rand() < 0.5) inst.flip = true;
        if (rule.tint && rule.tint > 0 && rand() < rule.tint) inst.tint = faintTint(rand(), rand());
        return inst;
      })
      .sort((a, b) => a.y - b.y);
    boxes.push(
      placed.map((inst) => ({
        inst,
        box: { ...boxSize(target, rule, inst), x: inst.x, y: inst.y, angle: inst.angle },
      })),
    );
    out.push(...placed);
  });
  // Rules drawn beneath the others (shadows) come first, keeping their own order.
  if (!rules.some((r) => r.beneath)) return out;
  return [
    ...out.filter((p) => rules[p.rule]?.beneath),
    ...out.filter((p) => !rules[p.rule]?.beneath),
  ];
}

/** A rule's fixed turn, in radians. */
const turnOf = (rule: DressRule): number => ((rule.turn ?? 0) * Math.PI) / 180;

function lineLength(line: readonly number[]): number {
  let total = 0;
  for (let i = 2; i + 1 < line.length; i += 2)
    total += Math.hypot(
      (line[i] ?? 0) - (line[i - 2] ?? 0),
      (line[i + 1] ?? 0) - (line[i - 1] ?? 0),
    );
  return total;
}
