/** The dice tray's pool of dice, as an expression. */

export const DICE = [4, 6, 8, 10, 12, 20, 100] as const;
export type Pool = Partial<Record<(typeof DICE)[number], number>>;

/** `2d6 + 1d20 + 3` from the pool and modifier. */
export function poolExpression(pool: Pool, modifier: number): string {
  const dice = DICE.filter((f) => (pool[f] ?? 0) > 0)
    .map((f) => `${String(pool[f])}d${String(f)}`)
    .join(' + ');
  const abs = String(Math.abs(modifier));
  if (modifier === 0) return dice || '0';
  if (!dice) return modifier > 0 ? abs : `-${abs}`;
  return modifier > 0 ? `${dice} + ${abs}` : `${dice} - ${abs}`;
}
