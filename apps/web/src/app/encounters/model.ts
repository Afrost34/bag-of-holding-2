import { newId } from '../cards/model';

/**
 * Encounters: the monsters of a fight, prepared ahead, with their difficulty for the party.
 *
 *   encounters/<id>.json                       encounters kept outside any campaign
 *   campaigns/<campaign>/encounters/<id>.json  a campaign's encounters
 *
 * Monsters are entity keys (`monster:goblin@xphb`) with a count, never copies of their stats.
 * The party is the campaign's characters; outside campaigns (or to plan for another party) it is
 * a list of character levels typed in by hand.
 */

export const ENCOUNTERS_DIR = 'encounters';

export interface EncounterMonster {
  key: string;
  count: number;
}

export interface Encounter {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  monsters: EncounterMonster[];
  /** Character levels typed in by hand; used instead of the campaign's characters when set. */
  party?: number[];
  notes?: string;
  /** The campaign it belongs to; absent outside campaigns. Not stored: it is where the file is. */
  campaign?: string;
}

export function encounterDir(campaign?: string): string {
  return campaign ? `campaigns/${campaign}/${ENCOUNTERS_DIR}` : ENCOUNTERS_DIR;
}

export function encounterPath(id: string, campaign?: string): string {
  return `${encounterDir(campaign)}/${id}.json`;
}

export function newEncounter(name: string, existingIds: readonly string[], now: string): Encounter {
  return {
    version: 1,
    id: newId(existingIds),
    name: name.trim() || 'Encounter',
    createdAt: now,
    updatedAt: now,
    monsters: [],
  };
}

/** Adds monsters: one more of a kind already there, else a new line. */
export function addMonsters(encounter: Encounter, keys: readonly string[]): Encounter {
  const monsters = encounter.monsters.map((m) => ({ ...m }));
  for (const key of keys) {
    const line = monsters.find((m) => m.key === key);
    if (line) line.count += 1;
    else monsters.push({ key, count: 1 });
  }
  return { ...encounter, monsters };
}

/** Sets how many of a monster there are; 0 removes the line. */
export function setCount(encounter: Encounter, key: string, count: number): Encounter {
  const n = Math.max(0, Math.min(99, Math.round(count)));
  return {
    ...encounter,
    monsters:
      n === 0
        ? encounter.monsters.filter((m) => m.key !== key)
        : encounter.monsters.map((m) => (m.key === key ? { ...m, count: n } : m)),
  };
}

/** How many creatures in all. */
export const creatureCount = (encounter: Encounter) =>
  encounter.monsters.reduce((n, m) => n + m.count, 0);

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseEncounter(
  text: string | null,
  id: string,
  campaign?: string,
): Encounter | null {
  if (!text) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(json)) return null;
  const monsters = (Array.isArray(json.monsters) ? json.monsters : []).flatMap((m) =>
    isObj(m) && typeof m.key === 'string'
      ? [{ key: m.key, count: typeof m.count === 'number' && m.count > 0 ? m.count : 1 }]
      : [],
  );
  const party = Array.isArray(json.party)
    ? json.party.filter((l): l is number => typeof l === 'number')
    : undefined;
  return {
    version: 1,
    id,
    name: typeof json.name === 'string' ? json.name : 'Encounter',
    createdAt: typeof json.createdAt === 'string' ? json.createdAt : '',
    updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : '',
    monsters,
    ...(party ? { party } : {}),
    ...(typeof json.notes === 'string' ? { notes: json.notes } : {}),
    ...(campaign ? { campaign } : {}),
  };
}

export function serializeEncounter(encounter: Encounter): string {
  const { campaign: _campaign, ...rest } = encounter;
  return `${JSON.stringify(rest, null, 2)}\n`;
}
