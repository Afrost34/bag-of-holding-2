import { newId } from '../cards/model';

/**
 * Encounters: the monsters of a fight, prepared ahead, with their difficulty for the party.
 *
 *   encounters/<id>.json                       encounters kept outside any campaign
 *   campaigns/<campaign>/encounters/<id>.json  a campaign's encounters
 *
 * Monsters are entity keys (`monster:goblin@xphb`) with a count, never copies of their stats.
 * A line can also be one of the campaign's NPCs: its journal note and name, fighting with the
 * stat block its note names.
 * The party is the campaign's characters; outside campaigns (or to plan for another party) it is
 * a list of character levels typed in by hand.
 */

export const ENCOUNTERS_DIR = 'encounters';

export interface EncounterMonster {
  /** The stat block. */
  key: string;
  count: number;
  /** A campaign NPC: the journal note it comes from. */
  npc?: string;
  /** The NPC's name, shown instead of the stat block's. */
  name?: string;
}

/** What tells lines apart: the NPC's note, else the stat block. */
export const lineId = (m: EncounterMonster) => m.npc ?? m.key;

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
    const line = monsters.find((m) => m.key === key && !m.npc);
    if (line) line.count += 1;
    else monsters.push({ key, count: 1 });
  }
  return { ...encounter, monsters };
}

/** Adds a campaign NPC (one more if already there), fighting with its stat block. */
export function addNpc(
  encounter: Encounter,
  npc: { note: string; name: string; statBlock: string },
): Encounter {
  if (encounter.monsters.some((m) => m.npc === npc.note))
    return setCount(
      encounter,
      npc.note,
      (encounter.monsters.find((m) => m.npc === npc.note)?.count ?? 0) + 1,
    );
  return {
    ...encounter,
    monsters: [
      ...encounter.monsters,
      { key: npc.statBlock, count: 1, npc: npc.note, name: npc.name },
    ],
  };
}

/** Sets how many there are on a line (see `lineId`); 0 removes it. */
export function setCount(encounter: Encounter, id: string, count: number): Encounter {
  const n = Math.max(0, Math.min(99, Math.round(count)));
  return {
    ...encounter,
    monsters:
      n === 0
        ? encounter.monsters.filter((m) => lineId(m) !== id)
        : encounter.monsters.map((m) => (lineId(m) === id ? { ...m, count: n } : m)),
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
      ? [
          {
            key: m.key,
            count: typeof m.count === 'number' && m.count > 0 ? m.count : 1,
            ...(typeof m.npc === 'string' ? { npc: m.npc } : {}),
            ...(typeof m.name === 'string' ? { name: m.name } : {}),
          },
        ]
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
