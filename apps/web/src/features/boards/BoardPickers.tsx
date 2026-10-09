/** The side panels a board opens to pick what to add: a map, a character, a journal note. */
import '@xyflow/react/dist/style.css';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { AppLink } from '../../app/AppLink';
import { useCharacters } from '../../app/characters/store';
import { NotePicker as FindNote } from '../../app/journal/NotePicker';
import { useJournal } from '../../app/journal/store';
import { useMaps } from '../../app/maps/store';

export function MapPicker({
  campaign,
  onPick,
}: {
  campaign?: string | undefined;
  onPick: (id: string) => void;
}) {
  const { maps, loaded, load } = useMaps();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const mine = maps.filter((m) => (m.campaign ?? null) === (campaign ?? null));
  if (mine.length === 0)
    return (
      <p className="text-sm text-muted">
        No maps here yet:{' '}
        <AppLink to="/maps" className="text-link hover:underline">
          make one
        </AppLink>
        .
      </p>
    );
  return (
    <ul aria-label="Maps" className="max-h-72 overflow-y-auto">
      {mine.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onClick={() => {
              onPick(m.id);
            }}
            className="w-full truncate px-2 py-1.5 text-left text-sm hover:bg-sunken"
          >
            {m.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CharacterPicker({
  campaign,
  onPick,
}: {
  campaign?: string | undefined;
  onPick: (id: string) => void;
}) {
  const { characters, loaded, load } = useCharacters();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  // The campaign's characters first, then the library's.
  const list = [...characters].sort(
    (a, b) => Number(b.campaign === campaign) - Number(a.campaign === campaign),
  );
  if (list.length === 0) return <p className="text-sm text-muted">No characters yet.</p>;
  return (
    <ul aria-label="Characters" className="max-h-72 overflow-y-auto">
      {list.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => {
              onPick(c.id);
            }}
            className="flex w-full items-baseline gap-2 px-2 py-1.5 text-left text-sm hover:bg-sunken"
          >
            <span className="font-medium">{c.name}</span>
            <span className="ml-auto truncate text-xs text-muted">{c.summary}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Panel({
  title,
  near,
  onClose,
  children,
}: {
  title: string;
  /** Where the board was right-clicked (px in the canvas): the panel opens there. */
  near?: { left: number; top: number };
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      style={near}
      className={`absolute z-20 rounded-lg border border-border bg-surface p-3 shadow-card ${near ? 'w-96 max-w-[calc(100%-1rem)]' : 'top-2 right-2 left-2 sm:left-auto sm:w-96'}`}
    >
      <div className="mb-2 flex items-center">
        <h2 className="flex-1 font-serif font-bold">{title}</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded p-1 text-muted hover:bg-sunken"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {children}
    </section>
  );
}

/** The campaign's journal notes, found by name, to put one on the board. */
export function NotePicker({ onPick }: { onPick: (path: string) => void }) {
  const notes = useJournal((s) => s.notes);
  return <FindNote notes={[...notes.keys()]} onPick={onPick} />;
}
