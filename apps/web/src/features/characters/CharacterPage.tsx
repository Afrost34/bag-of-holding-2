import type { CharacterDecisions } from '@boh/rules';
import { cn } from '@boh/ui';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
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
import { BackgroundStep } from './BackgroundStep';
import { ClassStep } from './ClassStep';
import { CompanionsStep } from './CompanionsStep';
import { EquipmentStep } from './EquipmentStep';
import { HomeStep } from './HomeStep';
import { PortraitButton } from './Portrait';
import { SheetView } from './SheetView';
import { SpeciesStep } from './SpeciesStep';
import { choicesByStep, rootOf, STEPS, stepOf, type StepId } from './steps';
import { knownSpells, KnownSpellsContext } from './knownSpells';
import { useCharacterView } from './useCharacterView';

/**
 * The character builder, laid out like D&D Beyond's: the steps across a bar at the top, the
 * character's name between previous / next arrows, then the step.
 */
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

  const rules = useMemo(
    () => ({ feats: character?.preferences.feats ?? true }),
    [character?.preferences.feats],
  );
  const view = useCharacterView(character?.decisions, rules);
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
  const index = STEPS.findIndex((s) => s.id === step);
  const prev = STEPS[index - 1];
  const next = STEPS[index + 1];

  const byStep = view ? choicesByStep(view.choices, view.grants) : null;
  const pending = view?.pending ?? [];
  const warnings = (view?.warnings ?? []).filter((w) => w.kind !== 'edition');
  const editionWarnings = (view?.warnings ?? []).filter((w) => w.kind === 'edition');
  const campaignName = campaigns.find((c) => c.id === character.campaign)?.name;
  const choices = byStep?.[step] ?? [];
  const known = knownSpells(view?.grants ?? [], (k) =>
    k === 'character' ? character.name : (view?.entities.find((e) => e.key === k)?.name ?? k),
  );

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-header text-header-fg shadow">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2">
          <AppLink
            to="/characters"
            aria-label="Characters"
            className="rounded p-1 hover:bg-black/20"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </AppLink>
          <div className="hidden min-w-0 shrink-0 sm:block">
            <p className="font-serif text-lg leading-tight font-bold">Character Builder</p>
            <p className="truncate text-xs opacity-80">{character.name}</p>
          </div>
          <nav aria-label="Builder steps" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {STEPS.map((s, i) => {
              const open = byStep?.[s.id].filter((c) => c.picks.length < c.count).length ?? 0;
              return (
                <AppLink
                  key={s.id}
                  to={`/characters/${id}?step=${s.id}`}
                  aria-current={s.id === step ? 'step' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-1 border-b-2 px-2 py-1.5 text-xs font-bold tracking-wide uppercase',
                    s.id === step
                      ? 'border-accent'
                      : 'border-transparent opacity-80 hover:opacity-100',
                  )}
                >
                  {i > 0 && i < STEPS.length - 1 && `${String(i)}. `}
                  {s.label}
                  {open > 0 && (
                    <span
                      className="rounded-full bg-accent px-1.5 text-[10px] text-accent-fg"
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
              'shrink-0 rounded px-2 py-1 text-xs font-bold',
              pending.length ? 'bg-accent text-accent-fg' : 'opacity-70',
            )}
          >
            {pending.length ? `${String(pending.length)} to choose` : 'All chosen'}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-5 flex items-center gap-2 border-b border-border pb-4">
          <StepArrow step={prev} direction="previous" onClick={goTo} />
          <PortraitButton character={character} view={view} save={save} />
          <div className="min-w-0 flex-1">
            <label htmlFor="character-name" className="block text-xs font-bold">
              Character Name
            </label>
            <input
              id="character-name"
              value={character.name}
              onChange={(e) => {
                save({ ...character, name: e.target.value });
              }}
              className="w-full max-w-xs rounded-md border border-border bg-surface px-2 py-1 font-medium focus:border-accent focus:outline-none"
            />
            <p className="truncate text-xs text-muted">
              {character.summary || 'Not built yet'} · {campaignName ?? 'Library'}
            </p>
          </div>
          <StepArrow step={next} direction="next" onClick={goTo} />
        </div>

        {status && !status.installed && (
          <p className="mb-4 rounded-md bg-sunken px-3 py-2 text-sm">
            Download the 5etools data in{' '}
            <AppLink to="/settings/data" className="text-link hover:underline">
              Settings
            </AppLink>{' '}
            to build characters.
          </p>
        )}

        {showPending && view && (
          <section
            aria-label="Pending choices"
            className="mb-5 rounded-lg border border-accent bg-surface p-4"
          >
            <h2 className="mb-2 font-serif text-lg font-bold">Still to choose</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted">Nothing left to choose.</p>
            ) : (
              <ul className="space-y-1">
                {pending.map((c) => {
                  const s = stepOf(c, view.grants);
                  const from = view.entities.find(
                    (e) => e.key === rootOf(c.from, view.grants),
                  )?.name;
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
          <section
            aria-label="Warnings"
            className="mb-5 space-y-1 rounded-lg bg-sunken p-3 text-sm"
          >
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

        <KnownSpellsContext.Provider value={known}>
          <StepBody
            step={step}
            character={character}
            view={view}
            choices={choices}
            campaignName={campaignName}
            isEnabled={isEnabled}
            disabledSources={[...disabled]}
            save={save}
            update={update}
            setPicks={setPicks}
          />
        </KnownSpellsContext.Provider>

        <div className="mt-8 flex justify-between border-t border-border pt-4">
          {prev ? (
            <button
              type="button"
              onClick={() => {
                goTo(prev.id);
              }}
              className="text-sm font-bold text-link uppercase"
            >
              ‹ {prev.label}
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button
              type="button"
              onClick={() => {
                goTo(next.id);
              }}
              className="text-sm font-bold text-link uppercase"
            >
              {next.label} ›
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepArrow({
  step,
  direction,
  onClick,
}: {
  step: (typeof STEPS)[number] | undefined;
  direction: 'previous' | 'next';
  onClick: (s: StepId) => void;
}) {
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      disabled={!step}
      aria-label={
        step ? `${direction === 'previous' ? 'Previous' : 'Next'}: ${step.label}` : undefined
      }
      onClick={() => {
        if (step) onClick(step.id);
      }}
      className="shrink-0 rounded bg-link p-1 text-surface disabled:bg-sunken disabled:text-faint"
    >
      <Icon className="h-6 w-6" aria-hidden />
    </button>
  );
}

function StepBody({
  step,
  character,
  view,
  choices,
  campaignName,
  isEnabled,
  disabledSources,
  save,
  update,
  setPicks,
}: {
  step: StepId;
  character: CharacterFile;
  view: ReturnType<typeof useCharacterView>;
  choices: NonNullable<ReturnType<typeof useCharacterView>>['choices'];
  campaignName: string | undefined;
  isEnabled: (source: string | undefined) => boolean;
  disabledSources: string[];
  save: (c: CharacterFile) => void;
  update: (d: CharacterDecisions) => void;
  setPicks: (choiceId: string, picks: string[]) => void;
}) {
  switch (step) {
    case 'home':
      return <HomeStep character={character} campaignName={campaignName} save={save} />;
    case 'class':
      return (
        <ClassStep
          character={character}
          view={view}
          update={update}
          setPicks={setPicks}
          isEnabled={isEnabled}
        />
      );
    case 'background':
      return (
        <BackgroundStep
          character={character}
          view={view}
          choices={choices}
          isEnabled={isEnabled}
          update={update}
          setPicks={setPicks}
          save={save}
        />
      );
    case 'species':
      return (
        <SpeciesStep
          decisions={character.decisions}
          view={view}
          choices={choices}
          isEnabled={isEnabled}
          update={update}
          setPicks={setPicks}
        />
      );
    case 'abilities':
      return <AbilitiesStep character={character} view={view} save={save} />;
    case 'equipment':
      return (
        <EquipmentStep
          character={character}
          view={view}
          choices={choices}
          isEnabled={isEnabled}
          disabledSources={disabledSources}
          save={save}
          setPicks={setPicks}
        />
      );
    case 'sheet':
      return (
        <div className="space-y-6">
          <AppLink
            to={`/characters/${character.id}/print`}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover"
          >
            <Printer className="h-4 w-4" aria-hidden /> Printable sheet (PDF)
          </AppLink>
          {view && (
            <SheetView
              view={view}
              decisions={character.decisions}
              abilityDisplay={character.preferences.abilityDisplay}
              update={update}
            />
          )}
          <section aria-label="Companions">
            <h2 className="mb-3 font-serif text-2xl">Companions</h2>
            <CompanionsStep character={character} save={save} disabledSources={disabledSources} />
          </section>
        </div>
      );
  }
}
