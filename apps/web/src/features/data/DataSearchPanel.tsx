import type { EntitySummary } from '@boh/data5e';
import { Panel } from '@boh/ui';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { dataWorker } from '../../app/data/client';
import { useSourceList } from '../../app/data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../../app/data/sourcePrefs';
import { typeLabel } from '../../app/format';

/** A plain search over the index, to check what was installed. The real compendium is M3. */
export function DataSearchPanel() {
  const [text, setText] = useState('');
  const [onlyEnabled, setOnlyEnabled] = useState(true);
  const [results, setResults] = useState<EntitySummary[]>([]);
  const sources = useSourceList((s) => s.sources);
  const overrides = useSourcePrefs((s) => s.overrides);

  const query = text.trim();
  const shown = query.length >= 2 ? results : [];

  useEffect(() => {
    let cancelled = false;
    if (query.length < 2) return;
    const timer = setTimeout(() => {
      void dataWorker()
        .search(query, {
          limit: 25,
          ...(onlyEnabled ? { excludeSources: disabledSourceIds(sources, overrides) } : {}),
        })
        .then((r) => {
          if (!cancelled) setResults(r);
        });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, onlyEnabled, sources, overrides]);

  return (
    <Panel title="Try it">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-faint"
            aria-hidden
          />
          <input
            type="search"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
            }}
            placeholder="Search spells, creatures, items…"
            aria-label="Search the data"
            className="h-9 w-full rounded-md border border-border bg-surface pr-3 pl-8 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={onlyEnabled}
            onChange={(e) => {
              setOnlyEnabled(e.target.checked);
            }}
            className="h-4 w-4 accent-[var(--boh-accent)]"
          />
          Enabled sources only
        </label>
      </div>
      {shown.length > 0 && (
        <table className="mt-3 w-full text-sm" aria-label="Search results">
          <thead>
            <tr className="text-left text-xs text-muted uppercase">
              <th className="py-1 font-medium">Name</th>
              <th className="py-1 font-medium">Type</th>
              <th className="py-1 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((r) => (
              <tr key={r.key}>
                <td className="py-1.5 pr-2 font-medium">{r.name}</td>
                <td className="py-1.5 pr-2 text-muted">{typeLabel(r.type)}</td>
                <td className="py-1.5 whitespace-nowrap text-muted">
                  {r.source}
                  <span className="ml-1.5 rounded bg-sunken px-1 text-[10px] font-semibold">
                    {r.edition}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {query.length >= 2 && shown.length === 0 && (
        <p className="mt-3 text-sm text-muted">No matches.</p>
      )}
    </Panel>
  );
}
