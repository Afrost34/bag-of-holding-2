/** Small pure helpers and types of the journal page. */
import { prettyName, type NoteType, type PropertyValue } from '@boh/journal';

export const folderOf = (path: string) =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
/** A note's or base's name without its extension. */
export const displayName = prettyName;
export const isBasePath = (path: string) => path.toLowerCase().endsWith('.base');
/** A folder's own name as words: `05_NPCs` → `NPCs`, for matching it to a kind of note. */
export const folderWords = (path: string) => (path.split('/').pop() ?? '').replace(/[_\d-]+/g, ' ');

/** What the "new note" form is making. */
export interface Creating {
  kind: 'template';
  path: string;
}

/** The wizard: a new note (of a kind, with some properties) or the open note's details. */
export type Wizard =
  | { mode: 'create'; type: NoteType | undefined; properties: Record<string, PropertyValue> }
  | { mode: 'edit' };

/** The text around a link, for the backlinks list. */
export function snippet(text: string, at: number): string {
  const start = text.lastIndexOf('\n', at) + 1;
  const end = text.indexOf('\n', at);
  return text
    .slice(start, end === -1 ? undefined : end)
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2');
}
