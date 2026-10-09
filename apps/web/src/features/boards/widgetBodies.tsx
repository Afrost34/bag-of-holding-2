import { NOTE_TYPES, newNoteText, setProperty } from '@boh/journal';
import { Button, cn } from '@boh/ui';
import {
  Backpack,
  BookOpen,
  NotebookPen,
  ScrollText,
  ShieldCheck,
  Shuffle,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useContext, useEffect, useState } from 'react';
import type { BoardCard } from '../../app/boards/model';
import { generateNames } from '../../app/boards/names';
import { generateNpc, type Npc } from '../../app/boards/npc';
import { useSpeciesNames } from '../../app/boards/useSpeciesNames';
import { CharacterSheetCard } from '../../app/characters/CharacterSheetCard';
import { useCharacters } from '../../app/characters/store';
import { JournalViewContext } from '../../app/journal/notes/context';
import { journalPath } from '../../app/journal/paths';
import { useJournal } from '../../app/journal/store';
import { useAppNavigate } from '../../app/navigation';
import { useBoardActions } from './context';

/**
 * Board widgets beyond notes and entries: a character at a glance, an NPC made up on the spot
 * and names to pick from (the map card is in MapCard.tsx).
 */

const SECTIONS = [
  { part: undefined, label: 'Sheet', Icon: UserRound },
  { part: 'spells', label: 'Spells', Icon: Sparkles },
  { part: 'features', label: 'Features', Icon: ScrollText },
  { part: 'inventory', label: 'Inventory', Icon: Backpack },
  { part: 'proficiencies', label: 'Proficiencies', Icon: ShieldCheck },
  { part: 'story', label: 'Story', Icon: BookOpen },
] as const;

/**
 * A character on a board: the first page of its sheet, or (with the tabs on the card's side) its
 * spells, features, inventory or story alone.
 */
export function CharacterBody({ card }: { card: Extract<BoardCard, { kind: 'character' }> }) {
  const { update } = useBoardActions();
  const open = (part: (typeof SECTIONS)[number]['part']) => {
    update(card.id, (c) => {
      if (c.kind !== 'character') return c;
      const { tab: _t, ...rest } = c;
      return part ? { ...rest, tab: part } : rest;
    });
  };
  return (
    <div className="-m-3 flex h-[calc(100%+1.5rem)]">
      <div
        role="tablist"
        aria-label="Sections"
        aria-orientation="vertical"
        className="flex shrink-0 flex-col gap-1 border-r border-border bg-surface-2 p-1"
      >
        {SECTIONS.map(({ part, label, Icon }) => {
          const on = card.tab === part;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={label}
              title={label}
              onClick={() => {
                open(part);
              }}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded px-1 py-1.5 text-[10px] font-semibold',
                on ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-sunken hover:text-text',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
      <div className="min-w-0 flex-1 overflow-auto p-3">
        <CharacterSelect
          value={card.character}
          onChange={(character) => {
            update(card.id, (c) => (c.kind === 'character' ? { ...c, character } : c));
          }}
        />
        <CharacterSheetCard
          characterId={card.character}
          {...(card.tab ? { only: card.tab } : {})}
        />
      </div>
    </div>
  );
}

/** Which character the card shows: any of the board's campaign (or of the library). */
function CharacterSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const campaignId = useContext(JournalViewContext)?.campaignId;
  const { characters, loaded, load } = useCharacters();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const mine = characters.filter((c) => (c.campaign ?? undefined) === campaignId || c.id === value);
  if (mine.length < 2) return null;
  return (
    <select
      aria-label="Character shown"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      className="mb-2 w-full rounded border border-border bg-surface px-2 py-1 text-sm"
    >
      {mine.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

/** What an NPC card lists, in order; older NPCs lack some lines. */
const NPC_LINES: [keyof Npc, string][] = [
  ['occupation', 'Occupation'],
  ['build', 'Build'],
  ['appearance', 'Looks'],
  ['clothing', 'Wears'],
  ['personality', 'Manner'],
  ['mannerism', 'Habit'],
  ['voice', 'Voice'],
  ['attitude', 'Attitude'],
  ['ideal', 'Ideal'],
  ['bond', 'Bond'],
  ['flaw', 'Flaw'],
  ['wants', 'Wants'],
  ['secret', 'Secret'],
  ['knows', 'Knows'],
  ['hook', 'Hook'],
];

/** An NPC made up on the spot: roll again, or keep it as a journal note. */
export function NpcBody({ card }: { card: Extract<BoardCard, { kind: 'npc' }> }) {
  const { update } = useBoardActions();
  const navigate = useAppNavigate();
  const journalCampaign = useJournal((s) => s.campaignId);
  const createNote = useJournal((s) => s.createNote);
  const pool = useSpeciesNames();
  const [species, setSpecies] = useState('');
  const npc = card.npc;
  const save = async () => {
    const type = NOTE_TYPES.find((t) => t.id === 'npc');
    if (!type) return;
    let text = newNoteText(type, npc.name);
    text = setProperty(text, 'race', npc.species);
    text = setProperty(text, 'role', npc.occupation);
    text = setProperty(text, 'motivation', npc.wants);
    text = setProperty(text, 'secret', npc.secret);
    text += `
A ${npc.age} ${npc.species.toLowerCase()} ${npc.gender}, ${npc.occupation}.
`;
    for (const [key, label] of NPC_LINES) {
      const value = npc[key];
      if (value && key !== 'occupation')
        text += `
- **${label}:** ${value}`;
    }
    const path = await createNote(
      type.folder,
      npc.name,
      `${text}
`,
    );
    navigate(journalPath(path));
  };
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted">
        A {npc.age} {npc.species.toLowerCase()} {npc.gender}
      </p>
      <dl className="space-y-1">
        {NPC_LINES.map(([key, label]) =>
          npc[key] ? (
            <div key={key} className="grid grid-cols-[5.5rem_1fr] gap-2">
              <dt className="text-xs font-semibold text-muted uppercase">{label}</dt>
              <dd>{npc[key]}</dd>
            </div>
          ) : null,
        )}
      </dl>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
        <SpeciesSelect value={species} species={pool} onChange={setSpecies} />
        <Button
          variant="ghost"
          onClick={() => {
            const next = generateNpc(Math.random, species || undefined, pool);
            update(card.id, (c) => (c.kind === 'npc' ? { ...c, npc: next } : c));
          }}
        >
          <Shuffle className="h-4 w-4" aria-hidden /> Another
        </Button>
        {journalCampaign && (
          <Button variant="ghost" onClick={() => void save()}>
            <NotebookPen className="h-4 w-4" aria-hidden /> Keep as a note
          </Button>
        )}
      </div>
    </div>
  );
}

function SpeciesSelect({
  value,
  species,
  onChange,
}: {
  value: string;
  species: readonly string[];
  onChange: (species: string) => void;
}) {
  return (
    <select
      value={value}
      aria-label="Species"
      onChange={(e) => {
        onChange(e.target.value);
      }}
      className="max-w-40 rounded border border-border bg-surface px-1 py-1 text-xs"
    >
      <option value="">Any species</option>
      {species.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

/** Names on demand: of one species or of any, as many as asked; click one to copy it. */
export function NamesBody({ card }: { card: Extract<BoardCard, { kind: 'names' }> }) {
  const { update } = useBoardActions();
  const pool = useSpeciesNames();
  const [count, setCount] = useState(Math.max(1, card.names.length || 20));
  const [copied, setCopied] = useState<string | null>(null);
  const roll = (species: string | undefined) => {
    const names = generateNames(count, pool, species);
    update(card.id, (c) => {
      if (c.kind !== 'names') return c;
      const { species: _s, ...rest } = c;
      return species ? { ...rest, species, names } : { ...rest, names };
    });
  };
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <SpeciesSelect
          value={card.species ?? ''}
          species={pool}
          onChange={(s) => {
            roll(s || undefined);
          }}
        />
        <input
          type="number"
          min={1}
          max={100}
          value={count}
          aria-label="How many names"
          onChange={(e) => {
            setCount(Math.max(1, Math.min(100, Math.round(Number(e.target.value)) || 1)));
          }}
          className="w-16 rounded border border-border bg-surface px-1 py-1 text-xs"
        />
        <Button
          variant="ghost"
          onClick={() => {
            roll(card.species);
          }}
        >
          <Shuffle className="h-4 w-4" aria-hidden /> Generate
        </Button>
      </div>
      <ul aria-label="Names" className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        {card.names.map((n, i) => (
          <li key={`${n.name}-${String(i)}`}>
            <button
              type="button"
              title={`${n.species} — click to copy`}
              onClick={() => {
                void navigator.clipboard.writeText(n.name);
                setCopied(n.name);
              }}
              className="w-full truncate rounded px-1 py-0.5 text-left hover:bg-sunken"
            >
              {n.name}
              {!card.species && <span className="ml-1 text-xs text-faint">{n.species}</span>}
            </button>
          </li>
        ))}
      </ul>
      {copied && (
        <p role="status" className="text-xs text-muted">
          Copied {copied}.
        </p>
      )}
    </div>
  );
}
