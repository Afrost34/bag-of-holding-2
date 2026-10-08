import type { Category, FieldDef, FieldValue, ListRow } from '@boh/data5e';
import { fieldLabel, parseFrontmatter, type NoteType, type PropertyValue } from '@boh/journal';
import { propertyText } from '../../app/journal/propertyText';

/**
 * A kind of note (NPCs, locations…) as a compendium list, like spells and items: one row per
 * note, columns and filters from the kind's properties, plus the note's folder and tags.
 */

/** Row field ids for note properties (prefixed, so `level` or `rarity` mean nothing special). */
export const propField = (key: string) => `p:${key}`;
export const FOLDER_FIELD = 'folder';
export const TAGS_FIELD = 'tags';

/** A text property with at most this many different values is offered as a filter. */
const FEW_VALUES = 25;

const asText = (v: PropertyValue | undefined): string => propertyText(v).trim();

function asValue(v: PropertyValue | undefined): FieldValue {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  if (Array.isArray(v)) return v.map((x) => asText(x)).filter(Boolean);
  return asText(v) || null;
}

/** The notes of one kind as list rows. */
export function noteRows(notes: ReadonlyMap<string, string>, typeId: string): ListRow[] {
  const rows: ListRow[] = [];
  for (const [path, text] of notes) {
    const props = parseFrontmatter(text).data as Record<string, PropertyValue>;
    if (typeof props.type !== 'string' || props.type.toLowerCase() !== typeId) continue;
    const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const f: Record<string, FieldValue> = {
      [FOLDER_FIELD]: folder || null,
      [TAGS_FIELD]: (Array.isArray(props.tags) ? props.tags : props.tags ? [props.tags] : [])
        .map((t) => asText(t).replace(/^#/, ''))
        .filter((t) => t && t !== typeId),
    };
    for (const [key, value] of Object.entries(props))
      if (key !== 'type' && key !== 'tags') f[propField(key)] = asValue(value);
    rows.push({
      key: path,
      type: 'note',
      name: path.split('/').pop()?.replace(/\.md$/i, '') ?? path,
      source: '',
      edition: '2024',
      page: null,
      f,
      sub: folder.split('/').slice(1).join(' › ') || folder,
    });
  }
  return rows;
}

const distinct = (rows: readonly ListRow[], id: string) => {
  const seen = new Set<string>();
  for (const r of rows) {
    const v = r.f[id];
    if (Array.isArray(v)) v.forEach((x) => seen.add(x));
    else if (v !== null && v !== undefined) seen.add(String(v));
  }
  return seen.size;
};

/** The list's columns (the kind's own) and filters (any property with few values). */
export function noteCategory(type: NoteType, rows: readonly ListRow[]): Category {
  const fields: FieldDef[] = [];
  const keys = [
    ...type.columns,
    ...type.fields.map((f) => f.key).filter((k) => !type.columns.includes(k)),
  ];
  let mainFilters = 0;
  for (const key of keys) {
    const def = type.fields.find((f) => f.key === key);
    const kind = def?.kind ?? 'text';
    if (kind === 'creature') continue;
    const id = propField(key);
    const values = distinct(rows, id);
    const field: FieldDef = {
      id,
      label: fieldLabel(key),
      kind:
        kind === 'number'
          ? 'number'
          : kind === 'checkbox'
            ? 'bool'
            : kind === 'links' || kind === 'list'
              ? 'tags'
              : 'enum',
      column: type.columns.includes(key),
      width: 8,
    };
    const filterable =
      values > 0 &&
      (kind === 'checkbox' ||
        def?.options !== undefined ||
        kind === 'link' ||
        kind === 'links' ||
        kind === 'list' ||
        values <= FEW_VALUES);
    if (filterable) field.filter = field.column && mainFilters++ < 3 ? 'main' : 'more';
    if (field.column || field.filter) fields.push(field);
  }
  if (distinct(rows, FOLDER_FIELD) > 1)
    fields.push({ id: FOLDER_FIELD, label: 'Folder', kind: 'enum', filter: 'more' });
  if (distinct(rows, TAGS_FIELD) > 0)
    fields.push({ id: TAGS_FIELD, label: 'Tag', kind: 'tags', filter: 'more' });
  return {
    id: `notes-${type.id}`,
    label: type.plural,
    noun: type.label.toLowerCase(),
    types: ['note'],
    fields,
  };
}
