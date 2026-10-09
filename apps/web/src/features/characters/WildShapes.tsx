import { crLabel, isEligibleForm, wildShapeLimits, type WildShapeLimits } from '@boh/rules';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import type { ListRow } from '@boh/data5e';
import { useMemo, useState } from 'react';
import type { CharacterFile, Companion } from '../../app/characters/model';
import { useListRows } from '../../app/data/lists';
import type { CharacterView } from '../../app/data/protocol';
import { LegacyBadge } from '../../app/lists/LegacyBadge';

/**
 * Wild Shape forms, chosen within what the Druid's level allows (number of known forms, highest
 * CR, fly and swim speeds) and what Circle Forms adds (Circle of the Moon). Chosen forms are
 * the character's Wild Shape companions, with their stat blocks below.
 */
export function WildShapes({
  character,
  view,
  isEnabled,
  save,
}: {
  character: CharacterFile;
  view: CharacterView;
  isEnabled: (source: string | undefined) => boolean;
  save: (c: CharacterFile) => void;
}) {
  const druid = view.classes.find((c) => c.key.startsWith('class:druid@'));
  const edition =
    view.entities.find((e) => e.key === druid?.key)?.edition ?? character.decisions.edition;
  const circleForms = view.features.some((f) => f.name === 'Circle Forms');
  const limits = druid ? wildShapeLimits(druid.levels, edition, circleForms) : null;
  if (!druid || !limits) return null;
  return (
    <FormPicker
      character={character}
      limits={limits}
      circleForms={circleForms}
      moonNote={
        circleForms && edition === '2024'
          ? `In a form: AC at least ${String(13 + view.sheet.abilities.wis.modifier)} (13 + Wisdom), ${String(3 * druid.levels)} temporary hit points.`
          : undefined
      }
      isEnabled={isEnabled}
      save={save}
    />
  );
}

function FormPicker({
  character,
  limits,
  circleForms,
  moonNote,
  isEnabled,
  save,
}: {
  character: CharacterFile;
  limits: WildShapeLimits;
  circleForms: boolean;
  /** Circle Forms' benefits in a form (2024). */
  moonNote: string | undefined;
  isEnabled: (source: string | undefined) => boolean;
  save: (c: CharacterFile) => void;
}) {
  const rows = useListRows('creatures');
  const [query, setQuery] = useState('');
  const forms = character.companions.filter((c) => c.kind === 'wild shape');
  const chosen = new Set(forms.map((f) => f.key));
  const full = limits.known !== null && forms.length >= limits.known;
  const anyBeast = character.preferences.wildShapeAnyBeast === true;
  // With the DM's leave, any Beast (still not a swarm); those beyond the rules are tagged.
  const listed = anyBeast ? NO_LIMITS : limits;
  const eligible = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => isEligibleForm(candidate(r), listed))
        .sort(
          (a, b) => Number(b.f.cr ?? 0) - Number(a.f.cr ?? 0) || a.name.localeCompare(b.name, 'en'),
        ),
    [rows, listed],
  );
  const q = query.trim().toLowerCase();
  const shown = eligible
    // From the sources in use, without superseded printings, unless already chosen.
    .filter((r) => chosen.has(r.key) || (isEnabled(r.source) && !r.legacy))
    .filter((r) => !q || r.name.toLowerCase().includes(q))
    .slice(0, 60);
  const add = (key: string) => {
    const form: Companion = { key, kind: 'wild shape' };
    save({ ...character, companions: [...character.companions, form] });
  };

  return (
    <section
      aria-label="Wild Shape"
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-serif text-lg font-bold">Wild Shape</h3>
        <p className="text-sm text-muted">
          {limits.known !== null
            ? `Forms known: ${String(forms.length)}/${String(limits.known)} · `
            : 'Any beast you have seen · '}
          CR up to {crLabel(limits.maxCr)}
          {!limits.fly && ' · no fly speed'}
          {!limits.swim && ' · no swim speed'}
          {circleForms && ' · Circle Forms'}
        </p>
      </div>
      {moonNote && <p className="text-sm">{moonNote}</p>}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={anyBeast}
          onChange={(e) => {
            save({
              ...character,
              preferences: { ...character.preferences, wildShapeAnyBeast: e.target.checked },
            });
          }}
        />
        Ignore the CR, fly and swim limits (DM's permission)
      </label>
      {full && (
        <p className="text-sm text-muted">
          All your forms are chosen. Remove one below (a long rest swaps one) to choose another.
        </p>
      )}
      <label className="relative block">
        <Search
          className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-faint"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          placeholder="Find a beast: wolf, bear…"
          aria-label="Find a Wild Shape form"
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          className="w-full rounded-md border border-border bg-surface py-2 pr-3 pl-8 text-base focus:border-accent focus:outline-none sm:text-sm"
        />
      </label>
      {rows === null ? (
        <p className="text-sm text-muted">Loading creatures…</p>
      ) : (
        <ul
          aria-label="Eligible forms"
          className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border"
        >
          {shown.map((r) => (
            <li key={r.key} className="flex items-center gap-3 px-3 py-1.5 text-sm">
              <span className="w-10 shrink-0 text-center text-xs font-bold text-muted">
                CR {String(r.f.crText ?? '')}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {r.name}
                {r.legacy && <LegacyBadge />}
                {anyBeast && !isEligibleForm(candidate(r), limits) && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-sunken px-1 text-[10px] font-semibold text-accent-ink">
                    <AlertTriangle className="h-3 w-3" aria-hidden /> beyond the rules
                  </span>
                )}
              </span>
              <span className="hidden truncate text-xs text-muted sm:block">
                {Array.isArray(r.f.speeds) ? r.f.speeds.join(', ') : ''}
              </span>
              <span className="w-12 shrink-0 text-right text-xs text-muted">{r.source}</span>
              {chosen.has(r.key) ? (
                <span className="w-16 shrink-0 text-right text-xs font-semibold text-accent-ink">
                  Known
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={`Add ${r.name} as a form`}
                  disabled={full}
                  onClick={() => {
                    add(r.key);
                  }}
                  className="inline-flex w-16 shrink-0 items-center justify-center gap-0.5 rounded border border-accent px-2 py-0.5 text-xs font-bold text-accent-ink uppercase hover:bg-accent hover:text-accent-fg disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" aria-hidden /> Add
                </button>
              )}
            </li>
          ))}
          {shown.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">No beast within these limits matches.</li>
          )}
        </ul>
      )}
    </section>
  );
}

/** Any Beast, whatever its CR and speeds (the number of forms known still counts). */
const NO_LIMITS: WildShapeLimits = { known: null, maxCr: 30, fly: true, swim: true };

/** A monster list row as Wild Shape reads it. */
function candidate(r: ListRow) {
  return {
    name: r.name,
    type: typeof r.f.type === 'string' ? r.f.type : '',
    cr: typeof r.f.cr === 'number' ? r.f.cr : null,
    speeds: Array.isArray(r.f.speeds) ? r.f.speeds.map(String) : [],
  };
}
