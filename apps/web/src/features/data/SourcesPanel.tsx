import type { SourceSummary } from '@boh/data5e';
import { Button, cn, Panel } from '@boh/ui';
import { ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  SOURCE_GROUPS,
  sourceGroup,
  useSourceList,
  type SourceGroupId,
} from '../../app/data/sourceList';
import { isSourceEnabled, useSourcePrefs } from '../../app/data/sourcePrefs';
import { formatNumber } from '../../app/format';

/** Groups open by default; adventures and "other" are long lists. */
const OPEN_BY_DEFAULT = new Set<SourceGroupId>(['core2024', 'core2014', 'homebrew']);

export function SourcesPanel() {
  const sources = useSourceList((s) => s.sources);
  const { overrides, setEnabled, reset } = useSourcePrefs();
  const [filter, setFilter] = useState('');

  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const visible = sources.filter(
      (s) =>
        s.entities > 0 &&
        (needle === '' ||
          s.name.toLowerCase().includes(needle) ||
          s.id.toLowerCase().includes(needle)),
    );
    return SOURCE_GROUPS.map((g) => ({
      ...g,
      sources: visible.filter((s) => sourceGroup(s) === g.id),
    })).filter((g) => g.sources.length > 0);
  }, [sources, filter]);

  const enabledCount = sources.filter(
    (s) => s.entities > 0 && isSourceEnabled(s, overrides),
  ).length;
  const total = sources.filter((s) => s.entities > 0).length;

  if (total === 0) return null;

  return (
    <Panel
      title="Sources"
      actions={
        <span className="text-xs text-header-fg/70">
          {enabledCount} of {total} on
        </span>
      }
    >
      <p className="mb-3 text-sm text-muted">
        Turned-off sources are hidden everywhere in the app. 2014 and 2024 versions are listed
        separately; turn off the edition you don&apos;t use. Playtest material is off until you turn
        it on. Each campaign will get its own list later.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-faint"
            aria-hidden
          />
          <input
            type="search"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
            }}
            placeholder="Filter sources"
            aria-label="Filter sources"
            className="h-9 w-full rounded-md border border-border bg-surface pr-3 pl-8 text-sm"
          />
        </label>
        <Button size="sm" variant="ghost" onClick={reset}>
          Reset to defaults
        </Button>
      </div>
      <div className="divide-y divide-border">
        {groups.map((group) => (
          <SourceGroup
            key={group.id}
            label={group.label}
            sources={group.sources}
            overrides={overrides}
            defaultOpen={filter !== '' || OPEN_BY_DEFAULT.has(group.id)}
            onToggle={(ids, enabled) => {
              setEnabled(ids, enabled);
            }}
          />
        ))}
      </div>
    </Panel>
  );
}

interface SourceGroupProps {
  label: string;
  sources: SourceSummary[];
  overrides: Record<string, boolean>;
  defaultOpen: boolean;
  onToggle: (ids: string[], enabled: boolean) => void;
}

function SourceGroup({ label, sources, overrides, defaultOpen, onToggle }: SourceGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const on = sources.filter((s) => isSourceEnabled(s, overrides)).length;
  const ids = sources.map((s) => s.id);
  const isOpen = open || defaultOpen;

  return (
    <section className="py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => {
            setOpen(!isOpen);
          }}
          className="flex flex-1 items-center gap-1.5 py-1 text-left text-sm font-semibold"
        >
          <ChevronRight
            className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')}
            aria-hidden
          />
          {label}
          <span className="font-normal text-muted">
            ({on}/{sources.length})
          </span>
        </button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onToggle(ids, true);
          }}
        >
          All
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onToggle(ids, false);
          }}
        >
          None
        </Button>
      </div>
      {isOpen && (
        <ul className="mt-1 grid gap-x-4 sm:grid-cols-2">
          {sources.map((source) => {
            const enabled = isSourceEnabled(source, overrides);
            return (
              <li key={source.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded px-1 py-1.5 hover:bg-sunken">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => {
                      onToggle([source.id], e.target.checked);
                    }}
                    className="h-4 w-4 shrink-0 accent-[var(--boh-accent)]"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm" title={source.name}>
                    {source.name}
                  </span>
                  {source.edition && (
                    <span className="rounded bg-sunken px-1 text-[10px] font-semibold text-muted">
                      {source.edition}
                    </span>
                  )}
                  <span className="w-12 shrink-0 text-right text-xs text-faint">
                    {formatNumber(source.entities)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
