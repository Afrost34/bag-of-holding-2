import type { CharacterDecisions } from '@boh/rules';
import { cn } from '@boh/ui';
import { AlertTriangle, ArrowLeft, ListChecks } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useCampaigns } from '../../app/campaigns/store';
import { summaryLine, type CharacterFile } from '../../app/characters/model';
import { useCharacter, useCharacters } from '../../app/characters/store';
import { useSourceList } from '../../app/data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../../app/data/sourcePrefs';
import { useData } from '../../app/data/store';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { AbilitiesStep } from './AbilitiesStep';
import { CompanionsStep } from './CompanionsStep';
import { DetailsStep } from './DetailsStep';
import { InventoryPanel } from './InventoryPanel';
import { SheetView } from './SheetView';
import { ClassStep } from './ClassStep';
import { BackgroundStep, ChoiceList, SpeciesStep } from './OriginSteps';
import { choicesByStep, rootOf, STEPS, stepOf, type StepId } from './steps';
import { useCharacterView } from './useCharacterView';

/** The character builder: steps across the top, the open choices always one click away. */
export function CharacterPage({ id, step }: { id: string; step: StepId }) {
  const { loaded, load, save } = useCharacters();
  const character = useCharacter(id);
  const navigate = useAppNavigate();
  const status = useData((s) => s.status);
  const refresh = useData((s) => s.refresh);
  const { sources, load: loadSources } = useSourceList();
  const overrides = useSourcePrefs((s) => s.overrides);
  const [showPending, setShowPending] = useState(false);
  const campaigns = useCampaigns((s) => s.campaigns);
  usePageTitle(character?.name ?? 'Character');

  useEffect(() => {
    if (!loaded) void load();
    void loadSources();
    if (!status) void refresh();
  }, [loaded, load, loadSources, status, refresh]);

  const view = useCharacterView(character?.decisions);
  const disabled = useMemo(
    () => new Set(disabledSourceIds(sources, overrides).map((s) => s.toLowerCase())),
    [sources, overrides],
  );
  const isEnabled = useCallback(
    (source: string | undefined) => !source || !disabled.has(source.toLowerCase()),
    [disabled],
  );

  // Keep the list line ("Level 3 Goblin Bard") in step with the character.
  useEffect(() => {
    if (!character || !view) return;
    const species = view.entities.find((e) => e.key === character.decisions.species)?.name;
    const line = summaryLine(view.level, species, view.classes);
    if (line !== character.summary) save({ ...character, summary: line });
  }, [view, character, save]);

  if (!loaded) return <p className="p-8 text-muted">Loading…</p>;
  if (!character)
    return (
      <div className="p-8">
        <p className="mb-3">This character is not in your library.</p>
        <AppLink to="/characters" className="text-link hover:underline">
          Back to characters
        </AppLink>
      </div>
    );

  const update = (decisions: CharacterDecisions) => {
    save({ ...character, decisions });
  };
  const setPicks = (choiceId: string, picks: string[]) => {
    const choices = { ...character.decisions.choices };
    // A different bundle (A or B, another lineage…) drops what was picked inside the old one.
    for (const key of Object.keys(choices))
      if (key.startsWith(`${choiceId}/`)) Reflect.deleteProperty(choices, key);
    if (picks.length) choices[choiceId] = picks;
    else Reflect.deleteProperty(choices, choiceId);
    update({ ...character.decisions, choices });
  };
  const goTo = (s: StepId) => {
    navigate(`/characters/${id}?step=${s}`);
  };

  const byStep = view ? choicesByStep(view.choices, view.grants) : null;
  const pending = view?.pending ?? [];
  const warnings = (view?.warnings ?? []).filter((w) => w.kind !== 'edition');
  const editionWarnings = (view?.warnings ?? []).filter((w) => w.kind === 'edition');
  const stepProps = {
    decisions: character.decisions,
    view,
    choices: byStep?.[step] ?? [],
    isEnabled,
    update,
    setPicks,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <AppLink
        to="/characters"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Characters
      </AppLink>
      <Header
        character={character}
        campaignName={campaigns.find((c) => c.id === character.campaign)?.name}
        save={save}
        level={view?.level ?? 0}
      />
      {status && !status.installed && (
        <p className="mb-4 rounded-md bg-sunken px-3 py-2 text-sm">
          Download the 5etools data in{' '}
          <AppLink to="/settings/data" className="text-link hover:underline">
            Settings
          </AppLink>{' '}
          to build characters.
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <nav aria-label="Builder steps" className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1">
          {STEPS.map((s, i) => {
            const open = byStep?.[s.id].filter((c) => c.picks.length < c.count).length ?? 0;
            return (
              <AppLink
                key={s.id}
                to={`/characters/${id}?step=${s.id}`}
                aria-current={s.id === step ? 'step' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm',
                  s.id === step
                    ? 'border-accent bg-accent text-accent-fg'
                    : 'border-border hover:bg-sunken',
                )}
              >
                <span className="text-xs opacity-70">{i + 1}</span> {s.label}
                {open > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-xs font-bold',
                      s.id === step ? 'bg-accent-fg text-accent' : 'bg-accent text-accent-fg',
                    )}
                    aria-label={`${String(open)} to choose`}
                  >
                    {open}
                  </span>
                )}
              </AppLink>
            );
          })}
        </nav>
        <button
          type="button"
          aria-expanded={showPending}
          onClick={() => {
            setShowPending(!showPending);
          }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium',
            pending.length ? 'border-accent text-accent' : 'border-border text-muted',
          )}
        >
          <ListChecks className="h-4 w-4" aria-hidden />
          {pending.length ? `${String(pending.length)} to choose` : 'All chosen'}
        </button>
      </div>

      {showPending && view && (
        <section
          aria-label="Pending choices"
          className="mb-5 rounded-lg border border-accent bg-surface p-4"
        >
          <h2 className="mb-2 font-serif text-lg font-bold">Pending choices</h2>
          {pending.length === 0 ? (
            <p className="text-sm text-muted">Nothing left to choose.</p>
          ) : (
            <ul className="space-y-1">
              {pending.map((c) => {
                const s = stepOf(c, view.grants);
                const from = view.entities.find((e) => e.key === rootOf(c.from, view.grants))?.name;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPending(false);
                        goTo(s);
                      }}
                      className="flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left hover:bg-sunken"
                    >
                      <span className="font-medium">{c.label}</span>
                      <span className="text-sm text-muted">
                        {from ?? STEPS.find((x) => x.id === s)?.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {(warnings.length > 0 || editionWarnings.length > 0) && (
        <section aria-label="Warnings" className="mb-5 space-y-1 rounded-lg bg-sunken p-3 text-sm">
          {warnings.map((w) => (
            <p key={`${w.kind}:${w.ref}`} className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />{' '}
              {w.message}
            </p>
          ))}
          {editionWarnings.length > 0 && (
            <p className="flex gap-2 text-muted">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              From the {character.decisions.edition === '2024' ? '2014' : '2024'} rules:{' '}
              {editionWarnings
                .map((w) => view?.entities.find((e) => e.key === w.ref)?.name ?? w.ref)
                .join(', ')}
              .
            </p>
          )}
        </section>
      )}

      {step === 'class' && <ClassStep {...stepProps} />}
      {step === 'species' && <SpeciesStep {...stepProps} />}
      {step === 'background' && <BackgroundStep {...stepProps} />}
      {step === 'abilities' && <AbilitiesStep character={character} view={view} save={save} />}
      {step === 'equipment' && (
        <div className="space-y-5">
          <ChoiceList {...stepProps} />
          <InventoryPanel
            character={character}
            view={view}
            save={save}
            disabledSources={[...disabled]}
          />
        </div>
      )}
      {step === 'spells' && (
        <ChoiceList {...stepProps} empty="This character has no spells to choose yet." />
      )}
      {step === 'companions' && (
        <CompanionsStep character={character} save={save} disabledSources={[...disabled]} />
      )}
      {step === 'details' && <DetailsStep character={character} save={save} />}
      {step === 'sheet' && view && (
        <SheetView view={view} decisions={character.decisions} update={update} />
      )}
    </div>
  );
}

function Header({
  character,
  campaignName,
  save,
  level,
}: {
  character: CharacterFile;
  /** The campaign it belongs to; the library when absent. */
  campaignName: string | undefined;
  save: (c: CharacterFile) => void;
  level: number;
}) {
  const edition = character.decisions.edition;
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor="character-name" className="sr-only">
          Character name
        </label>
        <input
          id="character-name"
          value={character.name}
          onChange={(e) => {
            save({ ...character, name: e.target.value });
          }}
          className="w-full rounded-md border border-transparent bg-transparent px-1 font-serif text-2xl font-bold hover:border-border focus:border-accent focus:outline-none"
        />
        <p className="px-1 text-muted">
          {character.summary || (level ? '' : 'Not built yet')}
          <span className="text-faint"> · {campaignName ?? 'Library'}</span>
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Rules"
        className="flex rounded-md border border-border p-0.5 text-sm"
      >
        {(['2024', '2014'] as const).map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={edition === e}
            onClick={() => {
              save({ ...character, decisions: { ...character.decisions, edition: e } });
            }}
            className={cn(
              'rounded px-2.5 py-1',
              edition === e ? 'bg-accent text-accent-fg' : 'hover:bg-sunken',
            )}
          >
            {e} rules
          </button>
        ))}
      </div>
    </div>
  );
}
