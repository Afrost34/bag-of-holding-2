import { Button } from '@boh/ui';
import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AppLink } from '../../../app/AppLink';
import { useCharacter, useCharacters } from '../../../app/characters/store';
import { usePageTitle } from '../../../app/tabs/usePageTitle';
import { useCharacterView } from '../useCharacterView';
import { PrintSheet } from './PrintSheet';

/**
 * The character sheet to print or save as PDF: a preview in the app, and a second copy outside
 * the app's layout that is the only thing the browser prints.
 */
export function PrintPage({ id }: { id: string }) {
  const { loaded, load } = useCharacters();
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

  if (!loaded) return <p className="p-8 text-muted">Loading…</p>;
  if (!character) return <p className="p-8">This character is not in your library.</p>;

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
          variant="primary"
          disabled={!view}
          onClick={() => {
            window.print();
          }}
        >
          <Printer className="h-4 w-4" aria-hidden /> Print / Save as PDF
        </Button>
      </div>
      <div className="overflow-x-auto py-6">
        {view ? (
          <PrintSheet character={character} view={view} />
        ) : (
          <p className="p-8 text-muted">Preparing the sheet…</p>
        )}
      </div>
      {view &&
        createPortal(
          <div className="print-root">
            <PrintSheet character={character} view={view} />
          </div>,
          document.body,
        )}
    </div>
  );
}
