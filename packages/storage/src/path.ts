/**
 * Store paths are POSIX-style and relative to the store root: `campaigns/rust/vault/index.md`.
 * No leading slash, no `.` or `..` segments, no backslashes. The root itself is `''`.
 */

export class InvalidPathError extends Error {
  constructor(path: string, reason: string) {
    super(`Invalid store path "${path}": ${reason}`);
    this.name = 'InvalidPathError';
  }
}

/** Normalizes a path to canonical form, throwing on anything that could escape the root. */
export function normalizePath(path: string): string {
  const segments = path.replaceAll('\\', '/').split('/');
  const out: string[] = [];
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') throw new InvalidPathError(path, '".." is not allowed');
    if (segment.includes('\0')) throw new InvalidPathError(path, 'null byte');
    out.push(segment);
  }
  return out.join('/');
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.join('/'));
}

/** Parent directory; `''` for top-level entries and the root. */
export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index);
}

export function basename(path: string): string {
  const normalized = normalizePath(path);
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

/** Splits a normalized path into its segments; `[]` for the root. */
export function segments(path: string): string[] {
  const normalized = normalizePath(path);
  return normalized === '' ? [] : normalized.split('/');
}
