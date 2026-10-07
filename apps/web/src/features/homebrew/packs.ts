import { HOMEBREW_DIR } from '../../app/data/homebrew';
import { typeLabel } from '../../app/format';

/** `homebrew/rust-sunfire.json` → `/homebrew/rust-sunfire`. */
export function packPath(path: string): string {
  const name = path.slice(HOMEBREW_DIR.length + 1).replace(/\.json$/i, '');
  return `/homebrew/${encodeURIComponent(name)}`;
}

/** A pack's file from its page's name. */
export function packFile(name: string): string {
  return `${HOMEBREW_DIR}/${name}.json`;
}

/** "3 items, 1 creature" */
export function packSummary(entries: readonly { type: string }[]): string {
  if (entries.length === 0) return 'Empty';
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  return [...counts]
    .map(([type, n]) => `${String(n)} ${typeLabel(type).toLowerCase()}${n === 1 ? '' : 's'}`)
    .join(', ');
}
