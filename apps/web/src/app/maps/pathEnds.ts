/**
 * How a path begins and ends (Dungeondraft's In and Out): a hard end, one that fades away, or one
 * that grows from nothing (shrinks to nothing). Pure; `shapes.ts` draws with the factors.
 */

export type PathEnd = 'hard' | 'fade' | 'grow';

export const PATH_ENDS: { id: PathEnd; name: string }[] = [
  { id: 'hard', name: 'Hard' },
  { id: 'fade', name: 'Faded' },
  { id: 'grow', name: 'Grow / shrink' },
];

/** The part of the path (its length) each soft end takes. */
export const END_RAMP = 0.22;

export interface EndFactor {
  /** Times the width. */
  width: number;
  /** Times the opacity. */
  alpha: number;
}

const ease = (x: number): number => x * x * (3 - 2 * x);

/** The width and opacity at `t` (0 start, 1 end) of a path. */
export function endFactor(t: number, start: PathEnd, end: PathEnd): EndFactor {
  const near = start === 'hard' ? 1 : ease(Math.min(1, Math.max(0, t / END_RAMP)));
  const far = end === 'hard' ? 1 : ease(Math.min(1, Math.max(0, (1 - t) / END_RAMP)));
  const width = (start === 'grow' ? near : 1) * (end === 'grow' ? far : 1);
  const alpha = (start === 'fade' ? near : 1) * (end === 'fade' ? far : 1);
  // A width of nothing is a gap: keep a hair so the line stays one piece.
  return { width: Math.max(0.05, width), alpha };
}

/** A path with soft ends needs drawing piece by piece. */
export const hasSoftEnds = (start: PathEnd | undefined, end: PathEnd | undefined): boolean =>
  (start ?? 'hard') !== 'hard' || (end ?? 'hard') !== 'hard';

/**
 * The line cut into pieces about `step` long, each with where along the path its middle is
 * (0–1). Pieces share their end points, so the line stays whole.
 */
export function piecesAlong(
  line: readonly number[],
  step: number,
): { points: number[]; t: number }[] {
  let total = 0;
  for (let i = 0; i + 3 < line.length; i += 2)
    total += Math.hypot(
      (line[i + 2] ?? 0) - (line[i] ?? 0),
      (line[i + 3] ?? 0) - (line[i + 1] ?? 0),
    );
  if (total === 0) return [];
  const out: { points: number[]; t: number }[] = [];
  let walked = 0;
  let from = 0;
  let piece: number[] = [line[0] ?? 0, line[1] ?? 0];
  for (let i = 0; i + 3 < line.length; i += 2) {
    const x2 = line[i + 2] ?? 0;
    const y2 = line[i + 3] ?? 0;
    walked += Math.hypot(x2 - (line[i] ?? 0), y2 - (line[i + 1] ?? 0));
    piece.push(x2, y2);
    if (walked - from >= step) {
      out.push({ points: piece, t: (from + walked) / 2 / total });
      from = walked;
      piece = [x2, y2];
    }
  }
  if (piece.length >= 4) out.push({ points: piece, t: (from + walked) / 2 / total });
  return out;
}
