import { ABILITIES, newCharacter, type Ability, type CharacterDecisions } from '@boh/rules';

/**
 * Characters as stored in the user's data:
 *
 *   characters/<id>.json     the character library (outside any campaign)
 *
 * A file holds the player's decisions (what the rules engine rebuilds the character from) and
 * the details only a person can write. Nothing computed is stored except a one-line summary for
 * lists, so a 5etools update can never leave a character out of date.
 */

export const CHARACTERS_DIR = 'characters';

export type AbilityMethod = 'standard' | 'pointBuy' | 'rolled' | 'manual';

export interface CharacterDetails {
  player?: string;
  alignment?: string;
  appearance?: string;
  personality?: string;
  backstory?: string;
  notes?: string;
}

export interface CharacterFile {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** "Level 3 Goblin Bard": written on save, for lists. */
  summary: string;
  abilityMethod: AbilityMethod;
  /** Rolled ability scores not yet placed (the rolled method). */
  rolls?: number[];
  decisions: CharacterDecisions;
  details: CharacterDetails;
}

export function characterPath(id: string): string {
  return `${CHARACTERS_DIR}/${id}.json`;
}

/** A short random id: characters are often renamed, so the name is not the id. */
export function newCharacterId(existing: readonly string[], random = Math.random): string {
  for (;;) {
    const id = Math.floor(random() * 36 ** 8)
      .toString(36)
      .padStart(8, '0');
    if (!existing.includes(id)) return id;
  }
}

export function newCharacterFile(
  name: string,
  edition: '2014' | '2024',
  existingIds: readonly string[],
  now: string,
  random = Math.random,
): CharacterFile {
  return {
    version: 1,
    id: newCharacterId(existingIds, random),
    name: name.trim() || 'New character',
    createdAt: now,
    updatedAt: now,
    summary: '',
    abilityMethod: 'standard',
    decisions: { ...newCharacter(edition), baseScores: standardArrayDefault() },
    details: {},
  };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reads a stored character, filling what older files lack. Null when it is not one. */
export function parseCharacter(text: string | null, id: string): CharacterFile | null {
  if (text === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(json) || !isObj(json.decisions)) return null;
  const d = json.decisions;
  const base = newCharacter(d.edition === '2014' ? '2014' : '2024');
  const scores = isObj(d.baseScores) ? d.baseScores : {};
  const decisions: CharacterDecisions = {
    ...base,
    ...(d as Partial<CharacterDecisions>),
    schema: 1,
    baseScores: Object.fromEntries(
      ABILITIES.map((a) => [a, typeof scores[a] === 'number' ? scores[a] : 10]),
    ) as Record<Ability, number>,
    classes: Array.isArray(d.classes) ? (d.classes as CharacterDecisions['classes']) : [],
    choices: isObj(d.choices) ? (d.choices as Record<string, string[]>) : {},
  };
  const method = json.abilityMethod;
  return {
    version: 1,
    id,
    name: typeof json.name === 'string' ? json.name : 'Unnamed character',
    createdAt: typeof json.createdAt === 'string' ? json.createdAt : '',
    updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : '',
    summary: typeof json.summary === 'string' ? json.summary : '',
    abilityMethod:
      method === 'pointBuy' || method === 'rolled' || method === 'manual' ? method : 'standard',
    ...(Array.isArray(json.rolls)
      ? { rolls: json.rolls.filter((n) => typeof n === 'number') }
      : {}),
    decisions,
    details: isObj(json.details) ? json.details : {},
  };
}

export function serializeCharacter(c: CharacterFile): string {
  return `${JSON.stringify(c, null, 2)}\n`;
}

// region Ability scores

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/** The standard array in the usual order (a starting point; the player rearranges it). */
export function standardArrayDefault(): Record<Ability, number> {
  return { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
}

export const POINT_BUY_BUDGET = 27;
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

/** Points a score costs in point buy, or null outside 8–15. */
export function pointCost(score: number): number | null {
  return POINT_COST[score] ?? null;
}

export function pointsSpent(scores: Record<Ability, number>): number {
  return ABILITIES.reduce((n, a) => n + (pointCost(scores[a]) ?? 99), 0);
}

/** 4d6, drop the lowest; `roll` returns one d6. */
export function rollAbility(roll: () => number): number {
  const dice = [roll(), roll(), roll(), roll()].sort((a, b) => a - b);
  return (dice[1] ?? 0) + (dice[2] ?? 0) + (dice[3] ?? 0);
}

/** Whether scores use each value of `pool` exactly once (standard array, rolled scores). */
export function usesPool(scores: Record<Ability, number>, pool: readonly number[]): boolean {
  const left = [...pool];
  for (const a of ABILITIES) {
    const i = left.indexOf(scores[a]);
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}

// endregion

/** "Level 3 Goblin Bard / Rogue": the line under a character's name. */
export function summaryLine(
  level: number,
  species: string | undefined,
  classes: readonly { name: string; levels: number }[],
): string {
  const cls =
    classes.length > 1
      ? classes.map((c) => `${c.name} ${String(c.levels)}`).join(' / ')
      : (classes[0]?.name ?? '');
  const parts = [species, cls].filter(Boolean).join(' ');
  return level > 0 ? `Level ${String(level)}${parts ? ` ${parts}` : ''}` : parts || 'Not built yet';
}
