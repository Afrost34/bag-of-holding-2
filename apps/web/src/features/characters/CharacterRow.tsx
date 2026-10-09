import * as Menu from '@radix-ui/react-dropdown-menu';
import { cn } from '@boh/ui';
import { AlertTriangle, Copy, Printer, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { AppLink } from '../../app/AppLink';
import type { CharacterFile } from '../../app/characters/model';
import { PortraitImage } from './Portrait';
import { useCharacterView } from './useCharacterView';

const iconButton =
  'inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm text-muted hover:bg-sunken hover:text-text';

/**
 * A character in the list: its picture, name and summary (to the builder), then Copy to another
 * campaign or the library, Export (the printable sheet) and Delete. Choices still open are
 * pointed out, and the card is highlighted until they are made.
 */
export function CharacterRow({
  character,
  places,
  onCopy,
  onDelete,
}: {
  character: CharacterFile;
  /** Where a copy can go: campaigns and the library. */
  places: readonly { id: string; label: string }[];
  onCopy: (place: string) => void;
  onDelete: () => void;
}) {
  const rules = useMemo(
    () => ({ feats: character.preferences.feats }),
    [character.preferences.feats],
  );
  const view = useCharacterView(character.decisions, rules);
  const open = view?.pending.length ?? 0;
  return (
    <li
      aria-label={character.name}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-surface p-3',
        open > 0 ? 'border-accent' : 'border-border',
      )}
    >
      <PortraitImage character={character} size={48} />
      <AppLink
        to={`/characters/${character.id}?step=class`}
        className="min-w-0 flex-1 hover:text-accent-ink"
      >
        <span className="block truncate font-serif text-lg font-bold">{character.name}</span>
        <span className="block truncate text-sm text-muted">
          {character.summary || 'Not built yet'}
        </span>
        {open > 0 && (
          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-accent px-2 text-xs font-bold text-accent-fg">
            <AlertTriangle className="h-3 w-3" aria-hidden /> {open} to choose
          </span>
        )}
      </AppLink>
      <Menu.Root>
        <Menu.Trigger aria-label={`Copy ${character.name} to`} className={iconButton}>
          <Copy className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Copy</span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-44 rounded-md border border-border bg-surface p-1 text-text shadow-card"
          >
            <Menu.Label className="px-2 py-1 text-xs font-semibold text-muted">Copy to</Menu.Label>
            {places.map((p) => (
              <Menu.Item
                key={p.id}
                className="rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-sunken"
                onSelect={() => {
                  onCopy(p.id);
                }}
              >
                {p.label}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
      <AppLink
        to={`/characters/${character.id}/print`}
        aria-label={`Export ${character.name}`}
        title="Printable sheet (PDF)"
        className={iconButton}
      >
        <Printer className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Export</span>
      </AppLink>
      <button
        type="button"
        aria-label={`Delete ${character.name}`}
        onClick={onDelete}
        className="rounded p-1.5 text-muted hover:bg-sunken hover:text-text"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}
