/**
 * Entity keys: the one way user data points at compendium content.
 *
 *   type:identity@source      e.g. spell:fireball@xphb
 *                                   classfeature:bardic inspiration|bard|phb|1@phb
 *
 * - `type` is the 5etools array name, lowercased (`monster`, `classfeature`, `subclass`…).
 * - `identity` is the entity's name, or for composite types the same `|`-joined parts that
 *   5etools uses in its own `{@tag}` links, minus the trailing source.
 * - Everything is lowercased and whitespace-collapsed, so keys compare case-insensitively.
 *
 * Keys are stored in user data, so this format must stay stable. Never change it without a
 * migration.
 */

export type EntityKey = string & { readonly __brand: 'EntityKey' };

export interface ParsedKey {
  type: string;
  identity: string;
  source: string;
}

function norm(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function makeKey(type: string, identityParts: readonly (string | number)[], source: string) {
  const identity = identityParts.map((p) => norm(String(p))).join('|');
  return `${norm(type)}:${identity}@${norm(source)}` as EntityKey;
}

/** Splits a key. The identity may contain `:` or `@`; the type never does, the source never has `@`. */
export function parseKey(key: string): ParsedKey | null {
  const colon = key.indexOf(':');
  const at = key.lastIndexOf('@');
  if (colon <= 0 || at <= colon) return null;
  const type = key.slice(0, colon);
  const identity = key.slice(colon + 1, at);
  const source = key.slice(at + 1);
  if (identity === '' || source === '') return null;
  return { type, identity, source };
}

export function isEntityKey(value: string): value is EntityKey {
  const parsed = parseKey(value);
  return parsed !== null && makeKey(parsed.type, [parsed.identity], parsed.source) === value;
}
