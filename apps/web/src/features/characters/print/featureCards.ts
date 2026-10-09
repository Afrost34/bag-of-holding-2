import type { CharacterDecisions } from '@boh/rules';

/**
 * Which features get a card on the printed sheet, and with what text. A feature's text can embed
 * other features (a subclass's level 3 features, a list of every invocation); those that apply
 * have cards of their own, so the references are left out. Features that only ask for a choice
 * (Warlock Subclass, Eldritch Invocation Options, Primal Order) have no card: the chosen subclass
 * or option does.
 */

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Tables with more rows than this, all told, do not fit a card: they are read in the app. */
const LONG_TABLES = 12;

/** How many table rows entries hold, nested ones included. */
function tableRows(entries: unknown): number {
  if (Array.isArray(entries)) return entries.reduce<number>((n, e) => n + tableRows(e), 0);
  if (!isObj(entries)) return 0;
  if (entries.type === 'table') return Array.isArray(entries.rows) ? entries.rows.length : 0;
  return tableRows(entries.entries);
}

/**
 * Entries without references to other features (`refSubclassFeature`, `refOptionalfeature`…),
 * and without tables too long for a card (Wild Magic Surge's 50 rows, the Artificer's four plan
 * lists): one line says where to find them.
 */
export function withoutReferences(entries: unknown): unknown[] {
  if (!Array.isArray(entries)) return [];
  const state = { dropTables: tableRows(entries) > LONG_TABLES, noted: false };
  return clean(entries, state);
}

function clean(entries: unknown[], state: { dropTables: boolean; noted: boolean }): unknown[] {
  const out: unknown[] = [];
  for (const e of entries) {
    if (isObj(e) && typeof e.type === 'string' && e.type.startsWith('ref')) continue;
    if (isObj(e) && e.type === 'table' && state.dropTables) {
      if (!state.noted) {
        // "Magic Item Plans (Artificer Level 2+)" → "Magic Item Plans".
        const caption =
          typeof e.caption === 'string' ? e.caption.replace(/\s*\(.*\)\s*$/, '') : 'Its';
        out.push(`{@i ${caption} tables: too long for a card, see them in the app.}`);
        state.noted = true;
      }
      continue;
    }
    if (isObj(e) && Array.isArray(e.entries)) {
      const inner = clean(e.entries, state);
      // A list of options, or a section, that only held references goes too.
      if (inner.length === 0 && (e.type === 'options' || !e.name)) continue;
      out.push({ ...e, entries: inner });
    } else out.push(e);
  }
  return out;
}

/** The words a reader sees in entries (for telling a real text from a one-line intro). */
export function plainText(entries: unknown): string {
  if (typeof entries === 'string') return entries.replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1');
  if (Array.isArray(entries)) return entries.map(plainText).join(' ');
  if (isObj(entries))
    return [entries.name, entries.entries, entries.items, entries.entry, entries.rows]
      .map(plainText)
      .join(' ');
  return '';
}

/** A one-paragraph intro to a list of options is this short at most. */
const INTRO = 160;

export interface FeatureLike {
  key: string;
  name: string;
}

export interface ChoiceLike {
  kind: string;
  /** The feature that asks. */
  via?: string;
}

/** Whether a feature only asks for a choice, so the chosen subclass or option prints instead. */
export function asksOnly(
  feature: FeatureLike,
  choices: readonly ChoiceLike[],
  text: unknown[],
): boolean {
  const asks = choices.filter((c) => c.via === feature.key);
  if (asks.some((c) => c.kind === 'subclass')) return true;
  if (/\boptions$/i.test(feature.name)) return true;
  return asks.length > 0 && plainText(text).trim().length < INTRO;
}

/**
 * A species trait as the chosen lineage tells it: a 2024 species's version picked through its
 * spells ("Elf; Wood Elf Lineage") replaces the trait ("Elven Lineage") with its own.
 */
export function lineageTrait(
  species: { key: string; data: Record<string, unknown> },
  traitName: string,
  decisions: Pick<CharacterDecisions, 'choices'>,
): unknown[] | undefined {
  const spells = species.data.additionalSpells;
  const versions = species.data._versions;
  if (!Array.isArray(spells) || !Array.isArray(versions)) return undefined;
  const pick = decisions.choices[`${species.key}/spells`]?.[0];
  const option: unknown = pick === undefined ? undefined : spells[Number(pick)];
  const name = isObj(option) && typeof option.name === 'string' ? option.name.toLowerCase() : null;
  if (!name) return undefined;
  const version: unknown = versions.find(
    (v) => isObj(v) && typeof v.name === 'string' && v.name.toLowerCase().includes(`; ${name} `),
  );
  const mods = isObj(version) && isObj(version._mod) ? version._mod.entries : undefined;
  for (const m of Array.isArray(mods) ? mods : [mods])
    if (isObj(m) && m.replace === traitName && isObj(m.items) && Array.isArray(m.items.entries))
      return m.items.entries as unknown[];
  return undefined;
}
