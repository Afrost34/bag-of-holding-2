import { Button } from '@boh/ui';
import { ArrowLeft, ListChecks, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppLink } from '../../../app/AppLink';
import { useCharacter, useCharacters } from '../../../app/characters/store';
import { usePageTitle } from '../../../app/tabs/usePageTitle';
import { useCharacterView } from '../useCharacterView';
import { PrintSheet } from './PrintSheet';
import { PRINT_SECTIONS, type PrintSection } from './sections';
import { usePrintData } from './usePrintData';

/**
 * The character sheet to print or save as PDF: a preview in the app, and a second copy outside
 * the app's layout that is the only thing the browser prints.
 */
export function PrintPage({ id }: { id: string }) {
  const { loaded, load, save } = useCharacters();
  const [choosing, setChoosing] = useState(false);
  const character = useCharacter(id);
  usePageTitle(character ? `${character.name} — sheet` : 'Character sheet');
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const rules = useMemo(
    () => ({ feats: character?.preferences.feats ?? true }),
    [character?.preferences.feats],
  );
  const view = useCharacterView(character?.decisions, rules);
  const hidden = useMemo(
    () =>
      (character?.preferences.printHidden ?? []).filter((h): h is PrintSection =>
        PRINT_SECTIONS.some((s) => s.id === h),
      ),
    [character?.preferences.printHidden],
  );
  const hiddenCards = character?.preferences.printHidden ?? [];
  const data = usePrintData(character, view ?? undefined, hiddenCards);

  if (!loaded) return <p className="p-8 text-muted">Loading…</p>;
  if (!character) return <p className="p-8">This character is not in your library.</p>;
  /** Leaves a section or a single card out, or puts it back. */
  const toggle = (id: string) => {
    save({
      ...character,
      preferences: {
        ...character.preferences,
        printHidden: hiddenCards.includes(id)
          ? hiddenCards.filter((h) => h !== id)
          : [...hiddenCards, id],
      },
    });
  };

  return (
    <div className="min-h-full bg-sunken">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2">
        <AppLink
          to={`/characters/${id}?step=sheet`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to the builder
        </AppLink>
        <h1 className="flex-1 font-serif text-lg font-bold">{character.name}</h1>
        <Button
          variant="ghost"
          aria-expanded={choosing}
          onClick={() => {
            setChoosing(!choosing);
          }}
        >
          <ListChecks className="h-4 w-4" aria-hidden /> Pages
        </Button>
        <Button
          variant="primary"
          disabled={!view}
          onClick={() => {
            window.print();
          }}
        >
          <Printer className="h-4 w-4" aria-hidden /> Print / Save as PDF
        </Button>
      </div>
      {choosing && (
        <fieldset className="flex flex-wrap gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-3 text-sm">
          <legend className="sr-only">Pages to print</legend>
          {PRINT_SECTIONS.map((s) => (
            <label key={s.id} className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={!hidden.includes(s.id)}
                onChange={() => {
                  toggle(s.id);
                }}
              />
              {s.label}
            </label>
          ))}
        </fieldset>
      )}
      {choosing && data.cardChoices.length > 0 && (
        <div className="space-y-2 border-b border-border bg-surface px-4 py-3 text-sm">
          <p className="font-semibold">Cards to print</p>
          {data.cardChoices.map((g) => (
            <fieldset key={g.title} className="flex flex-wrap gap-x-4 gap-y-1">
              <legend className="mb-1 text-xs font-bold text-muted uppercase">{g.title}</legend>
              {g.cards.map((c) => (
                <label key={c.id} className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={!hiddenCards.includes(c.id)}
                    onChange={() => {
                      toggle(c.id);
                    }}
                  />
                  {c.label}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      )}
      <div className="overflow-x-auto py-6">
        {view ? (
          <PrintSheet character={character} view={view} data={data} hidden={hidden} />
        ) : (
          <p className="p-8 text-muted">Preparing the sheet…</p>
        )}
      </div>
      {data.measurer}
      {view &&
        createPortal(
          <div className="print-root">
            <PrintSheet character={character} view={view} data={data} hidden={hidden} />
          </div>,
          document.body,
        )}
    </div>
  );
}
