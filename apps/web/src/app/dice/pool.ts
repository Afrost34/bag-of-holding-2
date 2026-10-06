/**
 * The dice tray's pool: dice the user picked, each d20 optionally rolled with advantage or
 * disadvantage, plus a flat modifier. Pure functions; the tray component holds the state.
 */

export const DICE = [4, 6, 8, 10, 12, 20, 100] as const;
export type Faces = (typeof DICE)[number];
export type DieMode = 'normal' | 'advantage' | 'disadvantage';

export interface PoolDie {
  faces: Faces;
  /** Only meaningful for d20s. */
  mode: DieMode;
}

export interface Pool {
  dice: PoolDie[];
  modifier: number;
}

export const EMPTY_POOL: Pool = { dice: [], modifier: 0 };

export function addDie(pool: Pool, faces: Faces, mode: DieMode = 'normal'): Pool {
  return { ...pool, dice: [...pool.dice, { faces, mode: faces === 20 ? mode : 'normal' }] };
}

/** Removes the most recently added die of that shape. */
export function removeDie(pool: Pool, faces: Faces): Pool {
  const index = pool.dice.map((d) => d.faces).lastIndexOf(faces);
  if (index === -1) return pool;
  return { ...pool, dice: pool.dice.filter((_, i) => i !== index) };
}

export function clearFaces(pool: Pool, faces: Faces): Pool {
  return { ...pool, dice: pool.dice.filter((d) => d.faces !== faces) };
}

export function countOf(pool: Pool, faces: Faces): number {
  return pool.dice.filter((d) => d.faces === faces).length;
}

export function isEmpty(pool: Pool): boolean {
  return pool.dice.length === 0 && pool.modifier === 0;
}

/**
 * The pool as one expression: dice grouped by shape (largest first, like a statblock), each
 * advantage/disadvantage d20 as its own `2d20kh1` / `2d20kl1` group, then the modifier.
 * `2d20kh1 + 1d20 + 2d6 + 3`
 */
export function poolExpression(pool: Pool): string {
  const parts: string[] = [];
  for (const faces of [...DICE].reverse()) {
    const ofShape = pool.dice.filter((d) => d.faces === faces);
    for (const mode of ['advantage', 'disadvantage'] as const) {
      const n = ofShape.filter((d) => d.mode === mode).length;
      for (let i = 0; i < n; i++) parts.push(mode === 'advantage' ? '2d20kh1' : '2d20kl1');
    }
    const plain = ofShape.filter((d) => d.mode === 'normal').length;
    if (plain > 0) parts.push(`${String(plain)}d${String(faces)}`);
  }
  let out = parts.join(' + ');
  const abs = String(Math.abs(pool.modifier));
  if (pool.modifier > 0) out = out ? `${out} + ${abs}` : abs;
  if (pool.modifier < 0) out = out ? `${out} - ${abs}` : `-${abs}`;
  return out;
}

/** A short human label for the pool, e.g. `2d6 + d20 (adv) + 3`. */
export function poolLabel(pool: Pool): string {
  return poolExpression(pool)
    .replace(/2d20kh1/g, 'd20 (adv)')
    .replace(/2d20kl1/g, 'd20 (dis)');
}
