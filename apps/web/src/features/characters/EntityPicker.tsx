import type { ListRow } from '@boh/data5e';
import { EntityView } from '@boh/renderer';
import { Button, cn } from '@boh/ui';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useEntity } from '../../app/data/entities';
import { useListRows } from '../../app/data/lists';

/**
 * Picks the class, species or background: a searchable list from the compendium, the character's
 * edition first. Once picked it shows what was picked, with its full text a click away.
 */
export function EntityPicker({
  category,
  types,
  noun,
  plural,
  value,
  edition,
  isEnabled,
  onPick,
}: {
  /** Compendium list category: `classes`, `species`, `backgrounds`. */
  category: string;
  /** Entity types to offer from that list (species lists subraces too). */
  types: readonly string[];
  noun: string;
  /** Lowercase plural for the search box: "classes". */
  plural: string;
  value: string | undefined;
  edition: '2014' | '2024';
  isEnabled: (source: string) => boolean;
  onPick: (key: string | undefined) => void;
}) {
  const rows = useListRows(category);
  const [query, setQuery] = useState('');
  const [changing, setChanging] = useState(false);
  const picked = rows?.find((r) => r.key === value);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank = (r: ListRow) => (r.edition === edition ? 0 : 1) + (r.legacy ? 1 : 0);
    return (rows ?? [])
      .filter((r) => types.includes(r.type) && isEnabled(r.source))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.source.toLowerCase().includes(q))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'en'));
  }, [rows, query, types, edition, isEnabled]);

  if (value && !changing)
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{noun}</p>
            <p className="font-serif text-xl font-bold">{picked?.name ?? value}</p>
            {picked && (
              <p className="text-sm text-muted">
                {picked.source}
                {picked.edition !== edition && ` · ${picked.edition} rules`}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setChanging(true);
            }}
          >
            Change {noun.toLowerCase()}
          </Button>
        </div>
        <EntityDetails entityKey={value} />
      </div>
    );

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="flex-1 font-serif text-lg font-bold">Choose a {noun.toLowerCase()}</h3>
        {changing && (
          <Button
            variant="ghost"
            onClick={() => {
              setChanging(false);
            }}
          >
            Cancel
          </Button>
        )}
      </div>
      <label className="relative mb-2 block">
        <Search
          className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-faint"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          placeholder={`Search ${plural}`}
          aria-label={`Search ${plural}`}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          className="w-full rounded-md border border-border bg-surface py-2 pr-3 pl-8 text-base focus:border-accent focus:outline-none sm:text-sm"
        />
      </label>
      {rows === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <ul className="max-h-96 overflow-y-auto" aria-label={plural}>
          {visible.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => {
                  onPick(r.key);
                  setChanging(false);
                  setQuery('');
                }}
                className={cn(
                  'flex w-full items-baseline gap-2 rounded-md px-2 py-2 text-left hover:bg-sunken',
                  r.key === value && 'bg-accent-soft',
                )}
              >
                <span className="font-medium">{r.name}</span>
                {r.legacy && (
                  <span className="rounded bg-sunken px-1 text-xs text-muted">Legacy</span>
                )}
                <span className="ml-auto text-xs text-muted">
                  {r.source}
                  {r.edition !== edition && ` · ${r.edition}`}
                </span>
              </button>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="px-2 py-2 text-sm text-muted">Nothing matches.</li>
          )}
        </ul>
      )}
    </div>
  );
}

/** The picked entity's text, folded away until asked for. */
function EntityDetails({ entityKey }: { entityKey: string }) {
  const [open, setOpen] = useState(false);
  const state = useEntity(open ? entityKey : null);
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
        className="text-sm font-medium text-link hover:underline"
      >
        {open ? 'Hide details' : 'Show details'}
      </button>
      {open && state.status === 'found' && (
        <div className="mt-3 border-t border-border pt-3">
          <EntityView
            type={state.entity.type}
            data={state.entity.data}
            edition={state.entity.edition}
          />
        </div>
      )}
    </div>
  );
}
