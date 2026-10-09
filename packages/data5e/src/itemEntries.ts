import type { RawEntity } from './identity';

/**
 * 5etools shares text between items with `{#itemEntry Name|Source}`: an item's entry stands for
 * an `itemEntry`'s `entriesTemplate`, filled with the item's own fields (`{{item.resist}}`,
 * `{{getFullImmRes item.resist}}`, `{{item.detail1}}`). "Ring of Necrotic Resistance" reads
 * "You have Resistance to necrotic damage while wearing this ring. The ring is set with jet."
 */

const REF = /^\{#itemEntry ([^|}]+)(?:\|([^}]+))?\}$/;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** `["fire", "cold"]` → "fire and cold"; three or more with commas. */
function listText(values: readonly unknown[]): string {
  const words = values.map((v) =>
    isObj(v) && Array.isArray(v.resist)
      ? listText(v.resist)
      : isObj(v) && typeof v.special === 'string'
        ? v.special
        : String(v),
  );
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1) ?? ''}`;
}

function fieldText(item: RawEntity, path: string): string {
  const value = path.split('.').reduce<unknown>((v, k) => (isObj(v) ? v[k] : undefined), item);
  if (Array.isArray(value)) return listText(value);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/** A template string filled with the item's fields. */
function fill(text: string, item: RawEntity): string {
  return text.replace(
    /\{\{\s*(?:(\w+)\s+)?item\.([\w.]+)\s*\}\}/g,
    (_, _helper: string, path: string) => fieldText(item, path),
  );
}

function fillAll(entry: unknown, item: RawEntity): unknown {
  if (typeof entry === 'string') return fill(entry, item);
  if (Array.isArray(entry)) return entry.map((e) => fillAll(e, item));
  if (isObj(entry))
    return Object.fromEntries(Object.entries(entry).map(([k, v]) => [k, fillAll(v, item)]));
  return entry;
}

/**
 * The item with its `{#itemEntry …}` entries written out, or null when it has none (or none
 * that can be found). `find` looks an itemEntry up by name and source.
 */
export function expandItemEntries(
  item: RawEntity,
  find: (name: string, source: string) => RawEntity | undefined,
): RawEntity | null {
  if (!Array.isArray(item.entries)) return null;
  let expanded = 0;
  const entries = item.entries.flatMap((e: unknown) => {
    const m = typeof e === 'string' ? REF.exec(e.trim()) : null;
    if (!m) return [e];
    const source = m[2] ?? (typeof item.source === 'string' ? item.source : '');
    const template = find(m[1] ?? '', source);
    const lines = template?.entriesTemplate;
    if (!Array.isArray(lines)) return [e];
    expanded++;
    return lines.map((line: unknown) => fillAll(line, item));
  });
  return expanded > 0 ? { ...item, entries } : null;
}
