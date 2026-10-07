import { CATEGORIES } from '@boh/data5e';
import { SCHOOLS } from '@boh/data5e/format';

/**
 * Where a 5etools reference tag leads in this app. `{@area}` is handled by the reader itself,
 * because area ids are only meaningful inside the current adventure.
 */

export function readerPath(
  kind: 'book' | 'adventure' | 'quickref',
  id: string,
  chapter?: string,
  header?: string,
): string {
  const params = new URLSearchParams();
  if (chapter && chapter !== '0') params.set('ch', chapter);
  if (header) params.set('h', header);
  const query = params.toString();
  return `/compendium/${kind}/${encodeURIComponent(id)}${query ? `?${query}` : ''}`;
}

/** 5etools list pages → our list categories. */
const PAGE_TO_CATEGORY: Record<string, string> = {
  'spells.html': 'spells', spells: 'spells', 'bestiary.html': 'creatures', bestiary: 'creatures',
  'items.html': 'items', items: 'items', 'feats.html': 'feats', feats: 'feats',
  'backgrounds.html': 'backgrounds', backgrounds: 'backgrounds', 'races.html': 'species', races: 'species',
  'optionalfeatures.html': 'options', optionalfeatures: 'options',
  'conditionsdiseases.html': 'conditions', conditionsdiseases: 'conditions',
  'deities.html': 'deities', deities: 'deities', 'rewards.html': 'rewards', rewards: 'rewards',
  'variantrules.html': 'rules', variantrules: 'rules', 'tables.html': 'tables', tables: 'tables',
  'vehicles.html': 'vehicles', vehicles: 'vehicles', 'trapshazards.html': 'hazards',
  trapshazards: 'hazards', 'languages.html': 'languages', languages: 'languages',
  'classes.html': 'classes', classes: 'classes', 'bastions.html': 'bastions', bastions: 'bastions',
}; // prettier-ignore

/** 5etools filter names → our field ids, with value conversion. */
const FILTER_FIELDS: Record<string, { field: string; value?: (v: string) => string }> = {
  level: { field: 'level' },
  'spell level': { field: 'level' },
  class: { field: 'classes', value: (v) => v.replace(/\b\w/g, (c) => c.toUpperCase()) },
  school: { field: 'school', value: (v) => { const n = SCHOOLS[v.toUpperCase()] ?? v; return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase(); } },
  rarity: { field: 'rarity', value: (v) => v.toLowerCase() },
  source: { field: 'source', value: (v) => v.toUpperCase() },
  'challenge rating': { field: 'cr' },
  cr: { field: 'cr' },
  type: { field: 'type', value: (v) => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() },
}; // prettier-ignore

/** `{@filter display|page|key=value;value2|…}` → a list URL with the filters we understand. */
export function filterPath(args: readonly string[]): string {
  const page = (args[1] ?? '').toLowerCase().trim();
  const category = PAGE_TO_CATEGORY[page];
  if (!category || !CATEGORIES.some((c) => c.id === category)) return '/compendium';
  const params = new URLSearchParams();
  for (const part of args.slice(2)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const spec = FILTER_FIELDS[part.slice(0, eq).trim().toLowerCase()];
    if (!spec) continue;
    const values = part
      .slice(eq + 1)
      .split(';')
      .map((v) => v.trim().replace(/^!/, ''))
      .filter(Boolean)
      .map((v) => (spec.value ? spec.value(v) : v));
    if (values.length) params.set(`f.${spec.field}`, values.join('~'));
  }
  const query = params.toString();
  return `/compendium/list/${category}${query ? `?${query}` : ''}`;
}

export type ReferenceRef = 'book' | 'adventure' | 'quickref' | 'area' | 'filter' | 'site';

/** The app path for a reference tag, or null when it has no destination here. */
export function referencePath(ref: ReferenceRef, args: readonly string[]): string | null {
  switch (ref) {
    case 'book':
    case 'adventure':
      return args[1] ? readerPath(ref, args[1], args[2], args[3]) : null;
    case 'quickref':
      // {@quickref name|source|chapter|header}
      return readerPath(
        'quickref',
        'bookref-quick',
        args[2] ?? '0',
        args[3]?.trim() ? args[3] : args[0],
      );
    case 'filter':
      return filterPath(args);
    default:
      return null;
  }
}
