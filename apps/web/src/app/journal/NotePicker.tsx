import { useState } from 'react';

/** A note's name as people know it: the file name, without folders or `.md`. */
const nameOf = (path: string) => (path.split('/').pop() ?? path).replace(/\.md$/i, '');

/**
 * Finds a journal note by typing part of its name (or folder): notes whose name starts with what
 * is typed come first. Used to put a note on a board and to link a map pin to one.
 */
export function NotePicker({
  notes,
  onPick,
  label = 'Find a note',
}: {
  /** The campaign's note paths. */
  notes: readonly string[];
  onPick: (path: string) => void;
  label?: string;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rank = (p: string) => (nameOf(p).toLowerCase().startsWith(q) ? 0 : 1);
  const found = notes
    .filter((p) => !q || p.toLowerCase().includes(q))
    .sort((a, b) => rank(a) - rank(b) || nameOf(a).localeCompare(nameOf(b), 'en'))
    .slice(0, 50);
  return (
    <div>
      <input
        type="search"
        value={query}
        aria-label={label}
        placeholder="Note name…"
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base focus:border-accent focus:outline-none sm:text-sm"
      />
      <ul aria-label="Notes" className="mt-1 max-h-72 overflow-y-auto">
        {found.map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => {
                onPick(p);
              }}
              className="flex w-full min-w-0 items-baseline gap-2 px-2 py-1.5 text-left text-sm hover:bg-sunken"
            >
              <span className="truncate">{nameOf(p)}</span>
              {p.includes('/') && (
                <span className="truncate text-xs text-muted">
                  {p.slice(0, p.lastIndexOf('/'))}
                </span>
              )}
            </button>
          </li>
        ))}
        {found.length === 0 && <li className="px-2 py-1.5 text-sm text-muted">No note matches.</li>}
      </ul>
    </div>
  );
}
