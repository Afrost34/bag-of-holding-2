import type { EntitySummary } from '@boh/data5e';
import { EntityView } from '@boh/renderer';
import { cn } from '@boh/ui';
import { ChevronDown, PawPrint, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  COMPANION_KINDS,
  COMPANION_LABELS,
  type CharacterFile,
  type Companion,
  type CompanionKind,
} from '../../app/characters/model';
import { dataWorker } from '../../app/data/client';
import { useEntity } from '../../app/data/entities';
import { pickName } from './steps';

const KIND_LABELS = COMPANION_LABELS;

/** Companions, familiars, mounts, Wild Shapes and summons: stat blocks attached to the character. */
export function CompanionsStep({
  character,
  save,
  disabledSources,
}: {
  character: CharacterFile;
  save: (c: CharacterFile) => void;
  disabledSources: readonly string[];
}) {
  const companions = character.companions;
  const set = (next: Companion[]) => {
    save({ ...character, companions: next });
  };
  return (
    <div className="space-y-4">
      <AddCreature
        disabledSources={disabledSources}
        onAdd={(key) => {
          set([...companions, { key, kind: 'companion' }]);
        }}
      />
      {companions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
          <PawPrint className="mx-auto mb-2 h-6 w-6" aria-hidden />
          Add a creature by name: a familiar from Find Familiar, a beast for Wild Shape, a mount…
        </div>
      ) : (
        companions.map((c, i) => (
          <CompanionCard
            key={`${c.key}-${String(i)}`}
            companion={c}
            onChange={(patch) => {
              set(companions.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            }}
            onRemove={() => {
              set(companions.filter((_, j) => j !== i));
            }}
          />
        ))
      )}
    </div>
  );
}

function CompanionCard({
  companion,
  onChange,
  onRemove,
}: {
  companion: Companion;
  onChange: (patch: Partial<Companion>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const state = useEntity(companion.key);
  const creature = state.status === 'found' ? state.entity : undefined;
  // An emptied name field falls back to the creature's name.
  const given = companion.name?.trim() ? companion.name : undefined;
  const label = given ?? creature?.name ?? pickName(companion.key);
  return (
    <section aria-label={label} className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? `Hide ${label}'s stat block` : `Show ${label}'s stat block`}
          onClick={() => {
            setOpen(!open);
          }}
          className="rounded p-1 hover:bg-sunken"
        >
          <ChevronDown className={cn('h-4 w-4 transition', !open && '-rotate-90')} aria-hidden />
        </button>
        <input
          value={companion.name ?? ''}
          placeholder={creature?.name ?? 'Name'}
          aria-label={`Name for ${creature?.name ?? 'the creature'}`}
          onChange={(e) => {
            onChange({ name: e.target.value });
          }}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 font-serif text-lg font-bold hover:border-border focus:border-accent focus:outline-none"
        />
        <select
          value={companion.kind}
          aria-label={`What ${label} is`}
          onChange={(e) => {
            onChange({ kind: e.target.value as CompanionKind });
          }}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
        >
          {COMPANION_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="rounded p-1 text-muted hover:bg-sunken"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {open && (
        <div className="border-t border-border px-4 py-3">
          {creature ? (
            <EntityView type={creature.type} data={creature.data} edition={creature.edition} />
          ) : (
            <p className="text-sm text-muted">
              {state.status === 'loading' ? 'Loading…' : 'This creature is not in your data.'}
            </p>
          )}
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium">Notes</span>
            <textarea
              rows={2}
              value={companion.notes ?? ''}
              onChange={(e) => {
                onChange({ notes: e.target.value });
              }}
              className="w-full rounded-md border border-border bg-surface px-3 py-2"
            />
          </label>
        </div>
      )}
    </section>
  );
}

/** Finds a creature by name and adds it. */
function AddCreature({
  onAdd,
  disabledSources,
}: {
  onAdd: (key: string) => void;
  disabledSources: readonly string[];
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntitySummary[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void dataWorker()
        .search(q, { types: ['monster'], excludeSources: disabledSources, limit: 12 })
        .then((r) => {
          if (!cancelled) setResults(r);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, disabledSources]);
  const shown = query.trim().length < 2 ? [] : results;
  return (
    <div>
      <label className="relative block">
        <Search
          className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-faint"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          placeholder="Add a creature"
          aria-label="Add a creature"
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          className="w-full rounded-md border border-border bg-surface py-2 pr-3 pl-8 text-base focus:border-accent focus:outline-none sm:text-sm"
        />
      </label>
      {shown.length > 0 && (
        <ul aria-label="Creatures found" className="mt-1 rounded-md border border-border">
          {shown.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => {
                  onAdd(r.key);
                  setQuery('');
                }}
                className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-sunken"
              >
                <span className="font-medium">{r.name}</span>
                <span className="ml-auto text-xs text-muted">{r.source}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
