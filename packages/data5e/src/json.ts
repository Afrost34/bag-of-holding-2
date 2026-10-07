/** Helpers for reading untyped 5etools JSON safely. */

export type Obj = Record<string, unknown>;

export const isObj = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const arr = (v: unknown): unknown[] =>
  Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];

export const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

export const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

/** A JSON value as display text: strings as-is, numbers formatted, anything else empty. */
export function text(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}
