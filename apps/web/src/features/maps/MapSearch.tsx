import { MapPin, Search, Type } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { searchMap, type MapHit } from '../../app/maps/mapSearch';
import type { MapDoc } from '../../app/maps/model';

/**
 * "Find on the map": type part of a pin's name, its category, or a name written on the map, pick
 * a result and the view goes there.
 */
export function MapSearch({ doc, onPick }: { doc: MapDoc; onPick: (hit: MapHit) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();
  const hits = useMemo(() => searchMap(doc, query), [doc, query]);
  return (
    <div className="relative">
      <label className="relative block">
        <Search
          className="pointer-events-none absolute top-2 left-2 h-4 w-4 text-faint"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          role="combobox"
          aria-label="Find on the map"
          aria-expanded={open && hits.length > 0}
          aria-controls={listId}
          placeholder="Find on the map…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          onBlur={() => {
            // A moment, so a click on a result still lands.
            setTimeout(() => {
              setOpen(false);
            }, 150);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && hits[0]) {
              onPick(hits[0]);
              setOpen(false);
            }
            if (e.key === 'Escape') setOpen(false);
          }}
          className="w-44 rounded-md border border-border bg-surface py-1.5 pr-2 pl-8 text-sm sm:w-56"
        />
      </label>
      {open && query.trim() !== '' && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Results"
          className="absolute top-full left-0 z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-card"
        >
          {hits.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-muted">Nothing by that name.</li>
          ) : (
            hits.map((h) => (
              <li key={h.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => {
                    onPick(h);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-sunken"
                >
                  {h.kind === 'pin' ? (
                    <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  ) : (
                    <Type className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate">{h.label}</span>
                  {h.category && <span className="shrink-0 text-xs text-muted">{h.category}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
