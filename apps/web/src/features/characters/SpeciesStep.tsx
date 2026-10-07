import type { ListRow } from '@boh/data5e';
import { Entries } from '@boh/renderer';
import type { AnsweredChoice, CharacterDecisions } from '@boh/rules';
import { cn } from '@boh/ui';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ArtImage } from '../../app/ArtImage';
import { useEntity } from '../../app/data/entities';
import { useListRows } from '../../app/data/lists';
import type { CharacterView } from '../../app/data/protocol';
import { SOURCE_GROUPS, sourceGroup, useSourceList } from '../../app/data/sourceList';
import { AbilityIncrease } from './AbilityIncrease';
import { ChoiceControl } from './ChoiceControl';
import { isAbilityIncrease } from './increaseModel';
import { forget } from './steps';
import { Accordion, StepTitle } from './ui';

/** Species traits that are only facts already shown elsewhere. */
const HIDDEN_TRAITS = new Set(['age', 'alignment', 'language', 'languages']);

/**
 * Choose Origin: Species, as on D&D Beyond: species grouped by book family with their art (older
 * printings behind "Show legacy content"); once chosen, its picks and its traits as folding rows.
 */
export function SpeciesStep({
  decisions,
  view,
  choices,
  isEnabled,
  update,
  setPicks,
}: {
  decisions: CharacterDecisions;
  view: CharacterView | null;
  choices: AnsweredChoice[];
  isEnabled: (source: string | undefined) => boolean;
  update: (next: CharacterDecisions) => void;
  setPicks: (choiceId: string, picks: string[]) => void;
}) {
  const [changing, setChanging] = useState(false);
  const key = decisions.species;
  const rows = useListRows('species');
  const row = rows?.find((r) => r.key === key);

  if (!key || changing)
    return (
      <SpeciesChooser
        edition={decisions.edition}
        current={row}
        isEnabled={isEnabled}
        onKeep={
          key
            ? () => {
                setChanging(false);
              }
            : undefined
        }
        onPick={(next) => {
          setChanging(false);
          update({ ...forget(decisions, key), species: next });
        }}
      />
    );

  // The +2/+1 increase is one control: its inner picks are not listed on their own.
  const increases = choices.filter(isAbilityIncrease).map((c) => `${c.id}/`);
  const shown = choices.filter((c) => !increases.some((p) => c.id.startsWith(p)));
  const traits = (view?.features ?? []).filter(
    (f) => f.from === key || f.from.startsWith('subrace:'),
  );
  return (
    <div className="space-y-5">
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-3xl">{row?.name ?? 'Species'}</h2>
          {row?.card?.blurb && <p className="mt-1 text-sm">{row.card.blurb}</p>}
          {traits.length > 0 && (
            <p className="mt-2 text-sm">
              <span className="font-bold">{row?.name} Traits: </span>
              {traits.map((t) => t.name).join(', ')}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <Art row={row} size={72} />
          <button
            type="button"
            onClick={() => {
              setChanging(true);
            }}
            className="text-sm text-link hover:underline"
          >
            Change Species
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {shown.map((c) => (
          <Accordion
            key={c.id}
            title={c.label
              .replace(/^Choose (an? |\d+ )?/i, '')
              .replace(/^\w/, (m) => m.toUpperCase())}
            subtitle={`${String(c.count)} Choice${c.count === 1 ? '' : 's'}`}
            pending={c.picks.length < c.count}
          >
            {isAbilityIncrease(c) ? (
              <AbilityIncrease choice={c} decisions={decisions} update={update} />
            ) : (
              <ChoiceControl
                choice={c}
                decisions={decisions}
                isEnabled={isEnabled}
                hideLabel
                onChange={(picks) => {
                  setPicks(c.id, picks);
                }}
              />
            )}
          </Accordion>
        ))}
        <Traits speciesKey={key} />
      </div>
    </div>
  );
}

/** The species' named traits with their text. */
function Traits({ speciesKey }: { speciesKey: string }) {
  const state = useEntity(speciesKey);
  if (state.status !== 'found' || !Array.isArray(state.entity.data.entries)) return null;
  const entries = (state.entity.data.entries as unknown[]).filter(
    (e): e is { name: string; entries?: unknown } =>
      typeof e === 'object' &&
      e !== null &&
      'name' in e &&
      typeof e.name === 'string' &&
      !HIDDEN_TRAITS.has(e.name.toLowerCase()),
  );
  return (
    <>
      {entries.map((e) => (
        <Accordion key={e.name} title={e.name}>
          <div className="text-sm">
            <Entries entries={e.entries ?? []} />
          </div>
        </Accordion>
      ))}
    </>
  );
}

function Art({ row, size }: { row: ListRow | undefined; size: number }) {
  return (
    <span
      className="flex shrink-0 overflow-hidden rounded bg-sunken"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {row?.card?.image && (
        <ArtImage
          path={row.card.image}
          widths={[96, 192]}
          sizes={`${String(size)}px`}
          className="h-full w-full object-cover object-top"
        />
      )}
    </span>
  );
}

function SpeciesChooser({
  edition,
  current,
  isEnabled,
  onKeep,
  onPick,
}: {
  edition: '2014' | '2024';
  current: ListRow | undefined;
  isEnabled: (source: string | undefined) => boolean;
  onKeep?: (() => void) | undefined;
  onPick: (key: string) => void;
}) {
  const rows = useListRows('species');
  const { sources, load } = useSourceList();
  const [query, setQuery] = useState('');
  const [legacy, setLegacy] = useState(false);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    void load();
  }, [load]);

  const bookName = (id: string) =>
    sources.find((s) => s.id.toLowerCase() === id.toLowerCase())?.name ?? id;
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const bySource = new Map(sources.map((s) => [s.id.toLowerCase(), s]));
    const visible = (rows ?? [])
      .filter((r) => r.type === 'race' && isEnabled(r.source) && (legacy || !r.legacy))
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(a.edition !== edition) - Number(b.edition !== edition) ||
          a.name.localeCompare(b.name, 'en'),
      );
    return SOURCE_GROUPS.map((g) => ({
      ...g,
      rows: visible.filter((r) => {
        const s = bySource.get(r.source.toLowerCase());
        return (s ? sourceGroup(s) : 'other') === g.id;
      }),
    })).filter((g) => g.rows.length > 0);
  }, [rows, sources, query, legacy, edition, isEnabled]);

  return (
    <div className="space-y-3">
      <StepTitle>{current ? 'Change Origin: Species' : 'Choose Origin: Species'}</StepTitle>
      {current && onKeep && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
          <Art row={current} size={36} />
          <span className="flex-1 font-bold uppercase">{current.name}</span>
          <button
            type="button"
            onClick={onKeep}
            className="rounded bg-accent px-2 py-1 text-xs font-bold text-accent-fg uppercase"
          >
            Keep species
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-faint"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            placeholder="Search species"
            aria-label="Search species"
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            className="w-full rounded-md border border-border bg-surface py-2 pr-3 pl-8 text-base focus:border-accent focus:outline-none sm:text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={legacy}
            onChange={(e) => {
              setLegacy(e.target.checked);
            }}
          />
          Show legacy content
        </label>
      </div>
      {rows === null && <p className="text-sm text-muted">Loading…</p>}
      {groups.map((g) => {
        const open = !closed.has(g.id);
        return (
          <section key={g.id} aria-label={g.label}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => {
                const next = new Set(closed);
                if (open) next.add(g.id);
                else next.delete(g.id);
                setClosed(next);
              }}
              className="flex w-full items-center gap-2 border-b border-border py-2 text-left"
            >
              <span className="flex-1 font-serif text-lg font-bold">{g.label}</span>
              <ChevronDown
                className={cn('h-4 w-4 text-faint transition', !open && '-rotate-90')}
                aria-hidden
              />
            </button>
            {open && (
              <ul className="mt-2 space-y-1.5" aria-label="species">
                {g.rows.map((r) => (
                  <li key={r.key}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(r.key);
                      }}
                      className="flex w-full items-center gap-3 rounded-md border border-border bg-surface px-2 py-1.5 text-left hover:border-accent"
                    >
                      <Art row={r} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold tracking-wide uppercase">{r.name}</span>
                        <span className="block truncate text-xs text-muted italic">
                          {bookName(r.source)}
                          {r.legacy && ' · Legacy'}
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-link" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
