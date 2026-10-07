import type { FieldDef, ListRow } from '@boh/data5e';

/** How list values read in cells and filters (compendium lists, the character builder). */

const FRACTION_CR: Record<string, string> = { '0.125': '1/8', '0.25': '1/4', '0.5': '1/2' };

const ORDINAL_SUFFIX = ['th', 'st', 'nd', 'rd'];

function ordinal(n: number): string {
  const v = n % 100;
  return `${String(n)}${ORDINAL_SUFFIX[(v - 20) % 10] ?? ORDINAL_SUFFIX[v] ?? 'th'}`;
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** How a value is shown in filters and cells. */
export function valueLabel(fieldId: string, value: string): string {
  if (fieldId === 'level') return value === '0' ? 'Cantrip' : ordinal(Number(value));
  if (fieldId === 'cr') return FRACTION_CR[value] ?? value;
  if (fieldId === 'rarity') return value === 'none' ? 'Mundane' : titleCase(value);
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  return value;
}

export function cellText(row: ListRow, field: FieldDef): string {
  if (field.display !== undefined) {
    const shown = row.f[field.display];
    if (typeof shown === 'string') return shown;
  }
  const v = row.f[field.id];
  if (v === null || v === undefined) return '';
  if (field.id === 'cr') return valueLabel('cr', String(v));
  if (field.id === 'level' || field.id === 'rarity') return valueLabel(field.id, String(v));
  if (field.id === 'value' && typeof v === 'number')
    return v >= 1 ? v.toLocaleString('en-US') : String(v);
  if (typeof v === 'boolean') return v ? '✓' : '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}
