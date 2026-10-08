import { noteType, parseFrontmatter } from '@boh/journal';

/** Route of a note in the journal, e.g. `Places/Waterdeep.md`. */
export function journalPath(note: string): string {
  return `/journal?note=${encodeURIComponent(note)}`;
}

/**
 * Where a link to a note leads: a note of a kind listed in the compendium (an NPC, a location…)
 * opens there, like a compendium entry; any other note opens in the journal.
 */
export function notePagePath(note: string, text: string | undefined): string {
  const type = text === undefined ? undefined : parseFrontmatter(text).data.type;
  if (typeof type === 'string' && noteType(type.toLowerCase()))
    return `/compendium/notes/${encodeURIComponent(type.toLowerCase())}?note=${encodeURIComponent(note)}`;
  return journalPath(note);
}
