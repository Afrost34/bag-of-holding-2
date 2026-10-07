/**
 * Encounter difficulty, by the rules of the campaign's edition.
 *
 * 2014 (DMG ch. 3): each character's XP thresholds (easy, medium, hard, deadly) are summed; the
 * monsters' XP is multiplied by a factor for their number (adjusted for small and large parties)
 * and compared with them.
 *
 * 2024 (DMG ch. 4): each character's XP budget (low, moderate, high) is summed and compared with
 * the monsters' plain XP total; no multiplier.
 */

export type EncounterRules = '2014' | '2024';

/** XP for a challenge rating, written as 5etools writes it ("1/4", "5"). */
const XP_BY_CR: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000,
  '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000,
  '28': 120000, '29': 135000, '30': 155000,
}; // prettier-ignore

/** 2014: easy, medium, hard, deadly, per character level 1–20. */
const THRESHOLDS_2014: readonly (readonly [number, number, number, number])[] = [
  [25, 50, 75, 100], [50, 100, 150, 200], [75, 150, 225, 400], [125, 250, 375, 500],
  [250, 500, 750, 1100], [300, 600, 900, 1400], [350, 750, 1100, 1700], [450, 900, 1400, 2100],
  [550, 1100, 1600, 2400], [600, 1200, 1900, 2800], [800, 1600, 2400, 3600],
  [1000, 2000, 3000, 4500], [1100, 2200, 3400, 5100], [1250, 2500, 3800, 5700],
  [1400, 2800, 4300, 6400], [1600, 3200, 4800, 7200], [2000, 3900, 5900, 8800],
  [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700],
]; // prettier-ignore

/** 2024: low, moderate, high, per character level 1–20. */
const BUDGET_2024: readonly (readonly [number, number, number])[] = [
  [50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500], [500, 750, 1100],
  [600, 1000, 1400], [750, 1300, 1700], [1000, 1700, 2100], [1300, 2000, 2600],
  [1600, 2300, 3100], [1900, 2900, 4100], [2200, 3700, 4700], [2600, 4200, 5400],
  [2900, 4900, 6200], [3300, 5400, 7800], [3800, 6100, 9800], [4500, 7200, 11700],
  [5000, 8700, 14200], [5500, 10700, 17200], [6400, 13200, 22000],
]; // prettier-ignore

/** 2014 multipliers, from fewest monsters up; a small or large party moves one step. */
const MULTIPLIERS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

/** A challenge rating as 5etools stores it: "1/2", or { cr: "1/2", lair: "2" }. */
export function crOf(cr: unknown): string | undefined {
  if (typeof cr === 'string') return cr;
  if (typeof cr === 'number') return String(cr);
  if (typeof cr === 'object' && cr !== null && 'cr' in cr && typeof cr.cr === 'string')
    return cr.cr;
  return undefined;
}

export function xpForCr(cr: unknown): number {
  const c = crOf(cr);
  return c === undefined ? 0 : (XP_BY_CR[c] ?? 0);
}

const clampLevel = (level: number) => Math.min(20, Math.max(1, Math.round(level)));

function multiplierIndex(monsters: number): number {
  if (monsters <= 1) return 1;
  if (monsters === 2) return 2;
  if (monsters <= 6) return 3;
  if (monsters <= 10) return 4;
  if (monsters <= 14) return 5;
  return 6;
}

/** 2014: the multiplier for a number of monsters fighting a party of `partySize`. */
export function encounterMultiplier(monsters: number, partySize: number): number {
  if (monsters <= 0) return 1;
  let i = multiplierIndex(monsters);
  if (partySize < 3) i += 1;
  else if (partySize >= 6) i -= 1;
  return MULTIPLIERS[Math.min(MULTIPLIERS.length - 1, Math.max(0, i))] ?? 1;
}

export interface DifficultyBand {
  label: string;
  xp: number;
}

export interface EncounterDifficulty {
  rules: EncounterRules;
  /** The monsters' XP before any multiplier. */
  baseXp: number;
  /** 2014 multiplier (1 under 2024). */
  multiplier: number;
  /** What is compared with the bands: adjusted XP (2014) or plain XP (2024). */
  xp: number;
  /** The party's thresholds, easiest first. */
  bands: DifficultyBand[];
  /** The hardest band reached; "Trivial" below the first. */
  rating: string;
  /** XP each character gets (2014 and 2024 alike: plain XP shared). */
  xpPerCharacter: number;
}

/**
 * How hard `monsters` (one challenge rating per creature) are for a party (one level per
 * character), under `rules`.
 */
export function encounterDifficulty(
  monsters: readonly unknown[],
  party: readonly number[],
  rules: EncounterRules,
): EncounterDifficulty {
  const baseXp = monsters.reduce<number>((n, cr) => n + xpForCr(cr), 0);
  const levels = party.map(clampLevel);
  const multiplier = rules === '2014' ? encounterMultiplier(monsters.length, levels.length) : 1;
  const xp = Math.round(baseXp * multiplier);
  const labels =
    rules === '2014' ? ['Easy', 'Medium', 'Hard', 'Deadly'] : ['Low', 'Moderate', 'High'];
  const table = rules === '2014' ? THRESHOLDS_2014 : BUDGET_2024;
  const bands = labels.map((label, i) => ({
    label,
    xp: levels.reduce((n, l) => n + (table[l - 1]?.[i] ?? 0), 0),
  }));
  const reached = bands.filter((b) => b.xp > 0 && xp >= b.xp);
  return {
    rules,
    baseXp,
    multiplier,
    xp,
    bands,
    rating: reached.at(-1)?.label ?? 'Trivial',
    xpPerCharacter: levels.length ? Math.floor(baseXp / levels.length) : 0,
  };
}
