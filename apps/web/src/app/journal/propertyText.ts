import type { PropertyValue } from '@boh/journal';

/** A property as text: links without their brackets, lists joined. */
export function propertyText(v: PropertyValue | undefined): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v))
    return v
      .map((x) => propertyText(x))
      .filter(Boolean)
      .join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v).replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1');
}
