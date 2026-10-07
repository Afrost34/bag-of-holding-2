import type { HeldGrant } from '@boh/rules';
import { createContext, useContext } from 'react';

/**
 * Spells the character already has, with where each comes from ("Magic Initiate", "Bard"), so a
 * spell pick can mark them and warn about taking one twice.
 */
export interface KnownSpell {
  /** The choice it was picked in, if it was picked. */
  choice?: string;
  /** What gives it, for the note: a feat, species or class name. */
  from: string;
}

export type KnownSpells = ReadonlyMap<string, readonly KnownSpell[]>;

export const KnownSpellsContext = createContext<KnownSpells>(new Map());

export function useKnownSpells(): KnownSpells {
  return useContext(KnownSpellsContext);
}

/** The same spell in two printings (2014 and 2024) is one spell: keyed by name. */
const spellName = (key: string) => key.slice(key.indexOf(':') + 1, key.lastIndexOf('@'));

/** Every spell grant, by spell name. `nameOf` turns an entity key into its name. */
export function knownSpells(
  grants: readonly HeldGrant[],
  nameOf: (key: string) => string,
): KnownSpells {
  const map = new Map<string, KnownSpell[]>();
  for (const g of grants) {
    if (g.kind !== 'spell') continue;
    const list = map.get(spellName(g.key)) ?? [];
    list.push({ ...(g.choice ? { choice: g.choice } : {}), from: nameOf(g.from) });
    map.set(spellName(g.key), list);
  }
  return map;
}

/** Where else a spell comes from, leaving out the choice being made. */
export function otherSources(known: KnownSpells, spell: string, choiceId: string): string[] {
  return (known.get(spellName(spell)) ?? [])
    .filter((k) => k.choice !== choiceId)
    .map((k) => k.from);
}
