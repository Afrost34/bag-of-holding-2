import type { ListRow } from '@boh/data5e';
import type { AnsweredChoice, CharacterDecisions, OptionSummary } from '@boh/rules';
import { cn } from '@boh/ui';
import { AlertTriangle, Minus, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useEntity } from '../../app/data/entities';
import { useListRows } from '../../app/data/lists';
import { LegacyBadge } from '../../app/lists/LegacyBadge';
import { SchoolIcon } from '../../app/lists/cells';
import { valueLabel } from '../../app/lists/labels';
import { SpellDetails } from '../../app/lists/SpellDetails';
import { otherSources, useKnownSpells } from './knownSpells';
import { pickName } from './steps';
import { useChoiceOptions } from './useCharacterView';

const ORDINAL = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/**
 * A spell choice — a class's cantrips or prepared spells, or a feat's picks such as Magic
 * Initiate's — as the compendium's spell list shows spells: a row per spell (school, name,
 * level, casting time, range) that opens to the full spell. Spells the character already has
 * from elsewhere are marked, and taking one twice is pointed out.
 */
export function SpellChoicePanel({
  choice,
  decisions,
  isEnabled,
  onChange,
  from,
  granted = [],
  joined = [],
}: {
  choice: AnsweredChoice;
  /** The feature that gives the pick, named in the heading ("Cantrips · Thaumaturge"). */
  from?: string | undefined;
  /** Spells of this list the character has anyway (a feat, the species, a domain), shown first. */
  granted?: readonly GrantedSpell[];
  /** Picks from the same list that a feature adds (Magician's cantrip), shown in this list. */
  joined?: readonly JoinedChoice[];
  decisions: CharacterDecisions;
  isEnabled: (source: string | undefined) => boolean;
  onChange: (picks: string[]) => void;
}) {
  // What is stored now: the engine's answer can lag behind quick picks.
  const picks = decisions.choices[choice.id] ?? choice.picks;
  // Folded until asked: the picks stay listed, the long list of options opens with "Add".
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<number | null>(null);
  const options = useChoiceOptions(decisions, choice.id, true);
  const rows = useListRows('spells');
  const known = useKnownSpells();
  // With the picks a feature adds to the same list: one count, one list, one Add.
  const extra = useMemo(
    () =>
      joined.map((j) => ({
        ...j,
        picks: decisions.choices[j.choice.id] ?? j.choice.picks,
      })),
    [joined, decisions.choices],
  );
  const allPicks = useMemo(() => [...picks, ...extra.flatMap((j) => j.picks)], [picks, extra]);
  const total = choice.count + extra.reduce((n, j) => n + j.choice.count, 0);
  const full = allPicks.length >= total;
  const ownIds = [choice.id, ...joined.map((j) => j.choice.id)];
  /** Learning fills the list's own picks first, then the features'. */
  const learn = (id: string) => {
    if (picks.length < choice.count) {
      onChange([...picks, id]);
      return;
    }
    const room = extra.find((j) => j.picks.length < j.choice.count);
    room?.onChange([...room.picks, id]);
  };
  const byKey = useMemo(() => new Map((rows ?? []).map((r) => [r.key, r])), [rows]);

  const levels = useMemo(
    () => [...new Set((options ?? []).map((o) => o.level ?? 0))].sort((a, b) => a - b),
    [options],
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (options ?? []).filter(
      (o) =>
        !allPicks.includes(o.id) &&
        isEnabled(o.source) &&
        (level === null || o.level === level) &&
        (!q || o.name.toLowerCase().includes(q)),
    );
  }, [options, allPicks, isEnabled, level, query]);
  const option = (id: string) => (options ?? []).find((o) => o.id === id);
  const twice = allPicks.filter((id) => otherSources(known, id, ownIds).length > 0);
  // "Cantrips", "Level 1 spell": what the pick is, rather than "Choose a spell".
  const only = levels.length === 1 ? levels[0] : undefined;
  const title =
    only === 0
      ? 'Cantrips'
      : only !== undefined && !/^prepare/i.test(choice.label)
        ? `Level ${String(only)} spell${choice.count === 1 ? '' : 's'}`
        : choice.label
            .replace(/^(Choose|Prepare) (\d+|an?) /, (m) =>
              m.startsWith('Prepare') ? 'Prepared ' : '',
            )
            .replace(/^\w/, (m) => m.toUpperCase());

  return (
    <section aria-label={choice.label} className="space-y-2">
      <div className="flex items-center gap-3 rounded-md bg-sunken px-3 py-2">
        <h4 className="flex-1 font-semibold">
          {title}
          {from && <span className="font-normal text-muted"> · {from}</span>}
        </h4>
        <span className={cn('text-sm font-bold', full ? 'text-text' : 'text-accent-ink')}>
          {allPicks.length}/{total}
        </span>
        <button
          type="button"
          aria-expanded={adding}
          onClick={() => {
            setAdding(!adding);
          }}
          className="rounded border border-border px-2 py-0.5 text-xs font-bold uppercase hover:border-accent"
        >
          {adding ? 'Done' : 'Add'}
        </button>
      </div>

      {twice.length > 0 && (
        <p role="alert" className="flex gap-2 rounded-md bg-sunken px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
          {twice
            .map(
              (id) =>
                `${option(id)?.name ?? pickName(id)} is already yours from ${otherSources(known, id, ownIds).join(' and ')}`,
            )
            .join('; ')}
          . Pick another spell to get the most from this choice.
        </p>
      )}

      {granted.length > 0 && <GrantedRows spells={granted} />}

      {allPicks.length > 0 && (
        <ul className="space-y-1.5">
          {picks.map((id) => (
            <SpellRowCard
              key={id}
              id={id}
              row={byKey.get(id)}
              option={option(id)}
              alsoFrom={otherSources(known, id, ownIds)}
              action="Remove"
              onAction={() => {
                onChange(picks.filter((p) => p !== id));
              }}
            />
          ))}
          {extra.flatMap((j) =>
            j.picks.map((id) => (
              <SpellRowCard
                key={`${j.choice.id}:${id}`}
                id={id}
                row={byKey.get(id)}
                option={option(id)}
                alsoFrom={[]}
                tag={j.tag}
                action="Remove"
                onAction={() => {
                  j.onChange(j.picks.filter((p) => p !== id));
                }}
              />
            )),
          )}
        </ul>
      )}

      {adding && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative block min-w-48 flex-1">
              <Search
                className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-faint"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                placeholder="Spell name"
                aria-label={`Search ${choice.label}`}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
                className="w-full rounded-md border border-border bg-surface py-2 pr-3 pl-8 text-base focus:border-accent focus:outline-none sm:text-sm"
              />
            </label>
            {levels.length > 1 && (
              <div className="flex flex-wrap gap-1" role="group" aria-label="Spell level">
                {levels.map((l) => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={level === l}
                    onClick={() => {
                      setLevel(level === l ? null : l);
                    }}
                    className={cn(
                      'rounded border px-2 py-1 text-xs font-bold',
                      level === l
                        ? 'border-accent bg-accent text-accent-fg'
                        : 'border-border hover:border-accent',
                    )}
                  >
                    {ORDINAL[l]}
                  </button>
                ))}
              </div>
            )}
          </div>
          {options === null ? (
            <p className="text-sm text-muted">Loading spells…</p>
          ) : (
            <ul
              className="max-h-[32rem] space-y-1.5 overflow-y-auto pr-1"
              aria-label={`${choice.label} options`}
            >
              {shown.map((o) => (
                <SpellRowCard
                  key={o.id}
                  id={o.id}
                  row={byKey.get(o.id)}
                  option={o}
                  alsoFrom={otherSources(known, o.id, choice.id)}
                  action="Learn"
                  disabled={full}
                  onAction={() => {
                    learn(o.id);
                  }}
                />
              ))}
              {shown.length === 0 && <li className="px-2 text-sm text-muted">No spell matches.</li>}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** One spell as in the compendium list: school icon, name, level, casting time, range. */
function SpellRowCard({
  id,
  row,
  option,
  alsoFrom,
  action,
  tag,
  disabled = false,
  onAction,
}: {
  id: string;
  row: ListRow | undefined;
  option: OptionSummary | undefined;
  /** Other things that already give this spell. */
  alsoFrom: string[];
  /** None for spells the character has anyway (they cannot be removed here). */
  action?: 'Learn' | 'Remove';
  /** Where a granted spell comes from ("Elf · 1/day"), in place of the second line. */
  tag?: string;
  disabled?: boolean;
  onAction?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const name = row?.name ?? option?.name ?? pickName(id);
  const text = (field: string) => {
    const display = row?.f[`${field}Text`];
    const v = typeof display === 'string' ? display : row?.f[field];
    return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
  };
  return (
    <li
      className={cn(
        'overflow-hidden rounded-lg border bg-surface',
        open ? 'border-accent' : 'border-border hover:border-border-strong',
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
          className="grid min-w-0 flex-1 grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,4.5rem)] items-center gap-x-3 text-left text-sm md:grid-cols-[2.25rem_minmax(0,1fr)_4.5rem_6rem_6rem]"
        >
          <SchoolIcon school={String(row?.f.school ?? '')} />
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[15px] font-semibold">{name}</span>
              {(row?.legacy ?? option?.legacy) && <LegacyBadge />}
            </span>
            <span className="block truncate text-xs text-muted">
              {tag ? (
                <span className="font-semibold text-accent-ink">{tag}</span>
              ) : alsoFrom.length > 0 ? (
                <span className="font-semibold text-accent-ink">
                  Already yours: {alsoFrom.join(', ')}
                </span>
              ) : (
                (row?.sub ?? option?.note)
              )}
            </span>
          </span>
          <span className="truncate">
            {row ? valueLabel('level', String(row.f.level ?? 0)) : ''}
          </span>
          <span className="hidden truncate md:block">{text('time')}</span>
          <span className="hidden truncate md:block">{text('range')}</span>
        </button>
        {action && (
          <button
            type="button"
            aria-label={`${action} ${name}`}
            disabled={disabled}
            onClick={onAction}
            className={cn(
              'shrink-0 rounded border px-2.5 py-1 text-xs font-bold uppercase disabled:opacity-40',
              action === 'Learn'
                ? 'border-accent text-accent-ink hover:bg-accent hover:text-accent-fg'
                : 'border-border text-muted hover:border-accent',
            )}
          >
            {action === 'Learn' ? (
              <Plus className="mr-0.5 inline h-3 w-3" aria-hidden />
            ) : (
              <Minus className="mr-0.5 inline h-3 w-3" aria-hidden />
            )}
            {action}
          </button>
        )}
      </div>
      {open && row && <Details row={row} />}
    </li>
  );
}

function Details({ row }: { row: ListRow }) {
  const state = useEntity(row.key);
  return (
    <div className="border-t border-border px-4 py-4 text-[15px] leading-relaxed">
      {state.status === 'found' ? (
        <SpellDetails row={row} entity={state.entity} />
      ) : (
        <p className="text-muted">Loading…</p>
      )}
    </div>
  );
}

/** A spell the character has from something else, shown in a list it belongs to. */
export interface GrantedSpell {
  key: string;
  /** Where it comes from and how it is had: "Elf · 1/day", "Life Domain · Always prepared". */
  tag: string;
}

/** Spells had anyway: rows like the picks, to open and read, without a Remove button. */
export function GrantedRows({ spells }: { spells: readonly GrantedSpell[] }) {
  const rows = useListRows('spells');
  const byKey = useMemo(() => new Map((rows ?? []).map((r) => [r.key, r])), [rows]);
  return (
    <ul className="space-y-1.5" aria-label="Spells you have from elsewhere">
      {spells.map((s) => (
        <SpellRowCard
          key={s.key}
          id={s.key}
          row={byKey.get(s.key)}
          option={undefined}
          alsoFrom={[]}
          tag={s.tag}
        />
      ))}
    </ul>
  );
}

/** A feature's pick from the same list as the class's (Magician: a Druid cantrip). */
export interface JoinedChoice {
  choice: AnsweredChoice;
  /** Where it comes from, on its rows ("Magician"). */
  tag: string;
  onChange: (picks: string[]) => void;
}
