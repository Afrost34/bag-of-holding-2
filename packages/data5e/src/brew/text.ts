/**
 * Plain text written in the homebrew editors ↔ 5etools entries. People write paragraphs; dice
 * they mention ("2d6 fire damage", "1d4 + 1") become rolls in the app without typing any tags.
 */

const DAMAGE_WORDS =
  /^\)?\s*(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\b/i;

/** Wraps dice in `{@damage …}` (before a damage type) or `{@dice …}`, leaving existing tags alone. */
export function tagDice(text: string): string {
  let out = '';
  let i = 0;
  // Copy `{@…}` tags as they are; tag dice everywhere else.
  for (const m of text.matchAll(/\{@[^}]*\}/g)) {
    out += tagPlain(text.slice(i, m.index));
    out += m[0];
    i = m.index + m[0].length;
  }
  return out + tagPlain(text.slice(i));
}

function tagPlain(text: string): string {
  return text.replace(
    /\b(\d*d\d+(?:\s*[+-]\s*\d+)?)\b/g,
    (dice: string, _: string, offset: number, all: string) => {
      const after = all.slice(offset + dice.length);
      return DAMAGE_WORDS.test(after) ? `{@damage ${dice}}` : `{@dice ${dice}}`;
    },
  );
}

/** Undoes `tagDice` (and reads other simple tags as their text) for editing. */
export function untag(text: string): string {
  return text.replace(/\{@(?:dice|damage|hit|d20) ([^}|]*)[^}]*\}/g, '$1');
}

/** Paragraphs (separated by a blank line) as entries. */
export function textToEntries(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map(tagDice);
}

export function entriesToText(entries: readonly string[]): string {
  return entries.map(untag).join('\n\n');
}

/**
 * Entries as text to edit, when they may hold more than paragraphs (tables, lists, inset boxes):
 * `original` remembers them so that saving text left alone keeps them exactly, and saving changed
 * text keeps what is not a paragraph after the new paragraphs.
 */
export interface RichText {
  text: string;
  original?: { text: string; entries: unknown[] };
}

export function richText(entries: unknown): RichText {
  const list = Array.isArray(entries) ? (entries as unknown[]) : [];
  const text = entriesToText(list.filter((e): e is string => typeof e === 'string'));
  return list.some((e) => typeof e !== 'string')
    ? { text, original: { text, entries: list } }
    : { text };
}

export function richEntries(value: RichText): unknown[] {
  const { original } = value;
  if (!original) return textToEntries(value.text);
  if (original.text === value.text) return original.entries;
  return [...textToEntries(value.text), ...original.entries.filter((e) => typeof e !== 'string')];
}
