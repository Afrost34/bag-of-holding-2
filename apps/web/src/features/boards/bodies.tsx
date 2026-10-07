import { EntityView } from '@boh/renderer';
import { Button, cn } from '@boh/ui';
import { ChevronRight, Pause, Play, Plus, RotateCcw, X } from 'lucide-react';
import { useContext, useEffect, useState } from 'react';
import { ArtImage } from '../../app/ArtImage';
import {
  nextTurn,
  sortInitiative,
  timerLeft,
  type BoardCard,
  type InitiativeRow,
} from '../../app/boards/model';
import { newId } from '../../app/cards/model';
import { useEntity } from '../../app/data/entities';
import { DICE } from '../../app/dice/pool';
import { useDice } from '../../app/dice/store';
import { attachmentUrl } from '../../app/journal/attachments';
import { JournalViewContext } from '../../app/journal/notes/context';
import { NoteViewer } from '../../app/journal/notes/NoteViewer';
import { useJournal } from '../../app/journal/store';
import { useBoardActions } from './context';

/** What a card shows under its title bar. */
export function CardBody({ card }: { card: BoardCard }) {
  switch (card.kind) {
    case 'entity':
      return <EntityBody entityKey={card.key} />;
    case 'note':
      return <NoteBody path={card.path} />;
    case 'image':
      return <ImageBody src={card.src} caption={card.caption} />;
    case 'text':
      return <TextBody card={card} />;
    case 'dice':
      return <DiceBody card={card} />;
    case 'timer':
      return <TimerBody card={card} />;
    case 'initiative':
      return <InitiativeBody card={card} />;
    case 'frame':
    case 'stack':
      return null;
  }
}

function EntityBody({ entityKey }: { entityKey: string }) {
  const state = useEntity(entityKey);
  if (state.status === 'loading') return <p className="text-muted">Loading…</p>;
  if (state.status === 'missing')
    return <p className="text-muted">Not in your data (or its source is turned off).</p>;
  const e = state.entity;
  return <EntityView type={e.type} data={e.data} edition={e.edition} />;
}

function NoteBody({ path }: { path: string }) {
  const text = useJournal((s) => s.notes.get(path));
  const hasJournal = useContext(JournalViewContext) !== null;
  if (!hasJournal) return <p className="text-muted">Notes show on the campaign’s boards.</p>;
  if (text === undefined) return <p className="text-muted">This note no longer exists.</p>;
  // Live: shown again whenever the note changes.
  return <NoteViewer key={text} text={text} />;
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
      className="h-full w-full resize-none bg-transparent focus:outline-none"
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
              className="px-2 py-1 text-xs font-semibold hover:text-accent"
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

function InitiativeBody({ card }: { card: Extract<BoardCard, { kind: 'initiative' }> }) {
  const { update } = useBoardActions();
  const [name, setName] = useState('');
  const [init, setInit] = useState('');
  const change = (fn: (c: Extract<BoardCard, { kind: 'initiative' }>) => Partial<typeof c>) => {
    update(card.id, (c) => (c.kind === 'initiative' ? { ...c, ...fn(c) } : c));
  };
  const setRow = (id: string, patch: Partial<InitiativeRow>) => {
    change((c) => ({ rows: c.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted uppercase">Round {card.round}</span>
        <Button
          variant="primary"
          className="ml-auto"
          disabled={card.rows.length === 0}
          onClick={() => {
            change((c) => nextTurn(c));
          }}
        >
          Next turn <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <ol aria-label="Initiative order" className="divide-y divide-border">
        {card.rows.map((r, i) => (
          <li
            key={r.id}
            aria-current={i === card.turn ? 'true' : undefined}
            className={cn(
              'flex items-center gap-2 py-1',
              i === card.turn && 'bg-accent-soft font-semibold',
            )}
          >
            <input
              type="number"
              value={r.initiative}
              aria-label={`${r.name} initiative`}
              onChange={(e) => {
                setRow(r.id, { initiative: Number(e.target.value) || 0 });
              }}
              onBlur={() => {
                change((c) => ({ rows: sortInitiative(c.rows) }));
              }}
              className="w-12 rounded border border-border bg-surface px-1 text-center text-sm"
            />
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <input
              value={r.hp ?? ''}
              placeholder="HP"
              aria-label={`${r.name} hit points`}
              onChange={(e) => {
                setRow(r.id, { hp: e.target.value });
              }}
              className="w-14 rounded border border-border bg-surface px-1 text-center text-sm"
            />
            <button
              type="button"
              aria-label={`Remove ${r.name}`}
              onClick={() => {
                change((c) => {
                  const rows = c.rows.filter((x) => x.id !== r.id);
                  return { rows, turn: Math.min(c.turn, Math.max(0, rows.length - 1)) };
                });
              }}
              className="text-muted hover:text-text"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          change((c) => ({
            rows: sortInitiative([
              ...c.rows,
              {
                id: newId(c.rows.map((r) => r.id)),
                name: name.trim(),
                initiative: Number(init) || 0,
              },
            ]),
          }));
          setName('');
          setInit('');
        }}
      >
        <input
          value={name}
          placeholder="Name"
          aria-label="Combatant name"
          onChange={(e) => {
            setName(e.target.value);
          }}
          className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-sm"
        />
        <input
          type="number"
          value={init}
          placeholder="Init"
          aria-label="Combatant initiative"
          onChange={(e) => {
            setInit(e.target.value);
          }}
          className="w-16 rounded border border-border bg-surface px-1 py-1 text-sm"
        />
        <Button type="submit" variant="ghost" aria-label="Add combatant">
          <Plus className="h-4 w-4" aria-hidden />
        </Button>
      </form>
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
