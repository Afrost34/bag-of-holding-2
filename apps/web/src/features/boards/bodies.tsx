import { parseFrontmatter } from '@boh/journal';
import { EntityView } from '@boh/renderer';
import { Button, cn } from '@boh/ui';
import { Pause, Play, Plus, RotateCcw, X } from 'lucide-react';
import { useContext, useEffect, useState } from 'react';
import { ArtImage } from '../../app/ArtImage';
import { timerLeft, type BoardCard } from '../../app/boards/model';
import { useEntity } from '../../app/data/entities';
import { DICE } from '../../app/dice/pool';
import { useDice } from '../../app/dice/store';
import { attachmentUrl } from '../../app/journal/attachments';
import { NotePicker } from '../../app/journal/NotePicker';
import { JournalViewContext } from '../../app/journal/notes/context';
import { NoteViewer } from '../../app/journal/notes/NoteViewer';
import { useJournal } from '../../app/journal/store';
import { CalendarGlance } from '../../app/calendar/CalendarGlance';
import { CombatBody, EncounterBody } from './combatBodies';
import { useBoardActions, useIsPlayersBoard } from './context';
import { MapBody } from './MapCard';
import { CharacterBody, NamesBody, NpcBody } from './widgetBodies';

/** What a card shows under its title bar. */
export function CardBody({ card }: { card: BoardCard }) {
  switch (card.kind) {
    case 'entity':
      return <EntityBody entityKey={card.key} />;
    case 'note':
      return <NoteBody card={card} />;
    case 'image':
      return <ImageBody src={card.src} caption={card.caption} />;
    case 'text':
      return <TextBody card={card} />;
    case 'dice':
      return <DiceBody card={card} />;
    case 'timer':
      return <TimerBody card={card} />;
    case 'combat':
      return <CombatBody card={card} />;
    case 'encounter':
      return <EncounterBody card={card} />;
    case 'map':
      return <MapBody card={card} />;
    case 'character':
      return <CharacterBody card={card} />;
    case 'npc':
      return <NpcBody card={card} />;
    case 'names':
      return <NamesBody card={card} />;
    case 'calendar':
      return <CalendarBody />;
    case 'frame':
    case 'stack':
      return null;
  }
}

/** The calendar of the board's campaign (boards show their campaign's journal and calendar). */
function CalendarBody() {
  const campaignId = useContext(JournalViewContext)?.campaignId;
  // On the players' board: no secrets and none of the DM's buttons.
  return <CalendarGlance campaignId={campaignId} forPlayers={useIsPlayersBoard()} />;
}

function EntityBody({ entityKey }: { entityKey: string }) {
  const state = useEntity(entityKey);
  if (state.status === 'loading') return <p className="text-muted">Loading…</p>;
  if (state.status === 'missing')
    return <p className="text-muted">Not in your data (or its source is turned off).</p>;
  const e = state.entity;
  return <EntityView type={e.type} data={e.data} edition={e.edition} />;
}

/** A journal note, live; another note can be put in its place without leaving the board. */
function NoteBody({ card }: { card: Extract<BoardCard, { kind: 'note' }> }) {
  const { update } = useBoardActions();
  const forPlayers = useIsPlayersBoard();
  const notes = useJournal((s) => s.notes);
  const text = notes.get(card.path);
  const hasJournal = useContext(JournalViewContext) !== null;
  const [choosing, setChoosing] = useState(false);
  if (!hasJournal) return <p className="text-muted">Notes show on the campaign’s boards.</p>;
  const change = !forPlayers && (
    <div className="mb-2 flex justify-end">
      <button
        type="button"
        aria-expanded={choosing}
        onClick={() => {
          setChoosing(!choosing);
        }}
        className="rounded px-1.5 py-0.5 text-xs text-link hover:bg-sunken"
      >
        {choosing ? 'Cancel' : 'Change note'}
      </button>
    </div>
  );
  if (choosing)
    return (
      <>
        {change}
        <NotePicker
          notes={[...notes.keys()]}
          onPick={(path) => {
            setChoosing(false);
            // The card keeps its size: it was set for this place on the board.
            update(card.id, (c) => (c.kind === 'note' ? { ...c, path } : c));
          }}
        />
      </>
    );
  if (text === undefined)
    return (
      <>
        {change}
        <p className="text-muted">This note no longer exists.</p>
      </>
    );
  // Live: shown again whenever the note changes. Only the content: properties stay in the journal.
  const body = text.slice(parseFrontmatter(text).bodyStart);
  return (
    <>
      {change}
      <NoteViewer key={body} text={body} />
    </>
  );
}

export function ImageBody({
  src,
  caption,
  campaignId,
}: {
  src: string;
  caption?: string | undefined;
  /** Where `journal:` pictures are; the open journal's when not given. */
  campaignId?: string | undefined;
}) {
  const journal = useContext(JournalViewContext);
  const url = useImageUrl(src, campaignId ?? journal?.campaignId);
  return (
    <figure className="flex h-full flex-col">
      {src.startsWith('art:') ? (
        <ArtImage
          path={src.slice(4)}
          widths={[640, 1280]}
          sizes="100vw"
          alt={caption ?? ''}
          className="min-h-0 flex-1 object-contain"
        />
      ) : url ? (
        <img src={url} alt={caption ?? ''} className="min-h-0 flex-1 object-contain" />
      ) : (
        <p className="text-muted">{url === null ? 'This picture is missing.' : 'Loading…'}</p>
      )}
      {caption && (
        <figcaption className="mt-1 text-center text-xs text-muted">{caption}</figcaption>
      )}
    </figure>
  );
}

function TextBody({ card }: { card: Extract<BoardCard, { kind: 'text' }> }) {
  const { update } = useBoardActions();
  return (
    <textarea
      value={card.text}
      aria-label="Text"
      placeholder="Write here…"
      onChange={(e) => {
        const text = e.target.value;
        update(card.id, (c) => (c.kind === 'text' ? { ...c, text } : c));
      }}
      className="block h-full w-full resize-none bg-transparent focus:outline-none"
    />
  );
}

function DiceBody({ card }: { card: Extract<BoardCard, { kind: 'dice' }> }) {
  const { update } = useBoardActions();
  const roll = useDice((s) => s.roll);
  const [formula, setFormula] = useState('');
  const rollIt = (expression: string) => {
    void roll({ kind: 'dice', expression, label: card.title ?? expression });
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {DICE.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              rollIt(`1d${String(d)}`);
            }}
            className="rounded border border-border px-2 py-1 text-xs font-semibold hover:border-accent"
          >
            d{d}
          </button>
        ))}
      </div>
      <ul className="flex flex-wrap gap-1" aria-label="Saved rolls">
        {card.formulas.map((f, i) => (
          <li key={`${f}-${String(i)}`} className="flex items-center rounded bg-sunken">
            <button
              type="button"
              onClick={() => {
                rollIt(f);
              }}
              className="px-2 py-1 text-xs font-semibold hover:text-accent-ink"
            >
              {f}
            </button>
            <button
              type="button"
              aria-label={`Forget ${f}`}
              onClick={() => {
                update(card.id, (c) =>
                  c.kind === 'dice' ? { ...c, formulas: c.formulas.filter((_, j) => j !== i) } : c,
                );
              }}
              className="px-1 text-muted hover:text-text"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const f = formula.trim();
          if (!f) return;
          update(card.id, (c) => (c.kind === 'dice' ? { ...c, formulas: [...c.formulas, f] } : c));
          setFormula('');
        }}
      >
        <input
          value={formula}
          aria-label="New roll"
          placeholder="2d6 + 3"
          onChange={(e) => {
            setFormula(e.target.value);
          }}
          className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-sm"
        />
        <Button type="submit" variant="ghost" aria-label="Save roll">
          <Plus className="h-4 w-4" aria-hidden />
        </Button>
      </form>
    </div>
  );
}

const clock = (s: number) => `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, '0')}`;

function TimerBody({ card }: { card: Extract<BoardCard, { kind: 'timer' }> }) {
  const { update } = useBoardActions();
  const [now, setNow] = useState(Date.now);
  const running = card.startedAt !== undefined;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      clearInterval(t);
    };
  }, [running]);
  const left = timerLeft(card, running ? now : 0);
  /** `startedAt: null` stops the clock. */
  const set = (change: { seconds?: number; elapsed?: number; startedAt?: number | null }) => {
    update(card.id, (c) => {
      if (c.kind !== 'timer') return c;
      const { startedAt, ...rest } = c;
      const started = change.startedAt === undefined ? startedAt : change.startedAt;
      return {
        ...rest,
        seconds: change.seconds ?? c.seconds,
        elapsed: change.elapsed ?? c.elapsed,
        ...(typeof started === 'number' ? { startedAt: started } : {}),
      };
    });
  };
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <p
        role="timer"
        aria-label="Time left"
        className={cn('font-mono text-4xl font-bold tabular-nums', left === 0 && 'text-str')}
      >
        {clock(left)}
      </p>
      <div className="flex items-center gap-1">
        {running ? (
          <Button
            variant="ghost"
            aria-label="Pause"
            onClick={() => {
              const t = Date.now();
              set({ elapsed: card.elapsed + t - (card.startedAt ?? t), startedAt: null });
            }}
          >
            <Pause className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button
            variant="ghost"
            aria-label="Start"
            disabled={left === 0}
            onClick={() => {
              set({ startedAt: Date.now() });
            }}
          >
            <Play className="h-4 w-4" aria-hidden />
          </Button>
        )}
        <Button
          variant="ghost"
          aria-label="Reset"
          onClick={() => {
            set({ elapsed: 0, startedAt: null });
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
        </Button>
        <label className="flex items-center gap-1 text-xs text-muted">
          <input
            type="number"
            min={1}
            value={Math.round(card.seconds / 60)}
            aria-label="Minutes"
            onChange={(e) => {
              const m = Math.max(1, Number(e.target.value) || 1);
              set({ seconds: m * 60 });
            }}
            className="w-14 rounded border border-border bg-surface px-1 py-0.5 text-sm text-text"
          />
          min
        </label>
      </div>
    </div>
  );
}

/** A picture's URL: `data:` as is, `journal:` read from the journal (undefined while loading). */
function useImageUrl(src: string, campaignId: string | undefined): string | null | undefined {
  const path = src.startsWith('journal:') ? src.slice(8) : null;
  const [state, setState] = useState<{ for: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!path || !campaignId) return;
    let live = true;
    void attachmentUrl(campaignId, path).then((url) => {
      if (live) setState({ for: `${campaignId}/${path}`, url });
    });
    return () => {
      live = false;
    };
  }, [campaignId, path]);
  if (!path) return src;
  if (!campaignId) return null;
  return state?.for === `${campaignId}/${path}` ? state.url : undefined;
}
