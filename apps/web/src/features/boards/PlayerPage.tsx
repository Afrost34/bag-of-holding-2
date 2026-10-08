import type { EntityDetail } from '@boh/data5e';
import { EntityView } from '@boh/renderer';
import { useEffect, useState, type ReactNode } from 'react';
import { usePlayerShow, type PlayerShow } from '../../app/boards/player';
import { useCampaigns } from '../../app/campaigns/store';
import { NoteViewer } from '../../app/journal/notes/NoteViewer';
import { useJournal } from '../../app/journal/store';
import { sortInitiative, timerLeft, type BoardCard } from '../../app/boards/model';
import { ImageBody } from './bodies';
import { MapBody } from './widgetBodies';
import { NotesProvider } from './noteView';

/** The player window: what the DM shows from a board, filling the screen. */
export function PlayerPage() {
  const { item, seq } = usePlayerShow();
  useEffect(() => {
    document.title = 'Bag of Holding — players';
  }, []);
  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-bg p-6 text-text">
      {item ? (
        <Shown key={seq} item={item} />
      ) : (
        <p className="text-center font-serif text-2xl text-muted">
          Waiting for the DM to show something…
        </p>
      )}
    </div>
  );
}

function Shown({ item }: { item: PlayerShow }) {
  switch (item.kind) {
    case 'image':
      return (
        <div className="h-full w-full">
          <ImageBody src={item.src} caption={item.caption} campaignId={item.campaignId} />
        </div>
      );
    case 'entity':
      return <ShownEntity entity={item.entity} />;
    case 'note':
      return <ShownNote campaignId={item.campaignId} path={item.path} />;
    case 'board':
      return <PlayerBoard item={item} />;
    case 'text':
      return (
        <article className="max-w-3xl text-xl leading-relaxed">
          {item.title && <h1 className="mb-4 font-serif text-3xl font-bold">{item.title}</h1>}
          <p className="whitespace-pre-wrap">{item.text}</p>
        </article>
      );
  }
}

function ShownEntity({ entity: e }: { entity: EntityDetail }) {
  return (
    <article className="max-h-full w-full max-w-3xl self-start text-lg">
      <h1 className="mb-3 font-serif text-3xl font-bold">{e.name}</h1>
      <EntityView type={e.type} data={e.data} edition={e.edition} />
    </article>
  );
}

function ShownNote({
  campaignId,
  path,
  bare = false,
}: {
  campaignId: string;
  path: string;
  /** Inside a card that has the title already. */
  bare?: boolean;
}) {
  const { campaigns, loaded, load } = useCampaigns();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  // Read again each time it is shown: the DM may have edited it since.
  useEffect(() => {
    const journal = useJournal.getState();
    if (journal.campaignId === campaignId) void journal.refresh();
  }, [campaignId]);
  const campaign = campaigns.find((c) => c.id === campaignId);
  const text = useJournal((s) => (s.campaignId === campaignId ? s.notes.get(path) : undefined));
  return (
    <NotesProvider campaign={campaign}>
      <article className="max-h-full w-full max-w-3xl self-start text-lg">
        {!bare && (
          <h1 className="mb-3 font-serif text-3xl font-bold">
            {path.split('/').pop()?.replace(/\.md$/i, '')}
          </h1>
        )}
        {text !== undefined && campaign && <NoteViewer key={text} text={text} />}
      </article>
    </NotesProvider>
  );
}

/** The cards the DM shows, side by side, read-only, following the board as it changes. */
function PlayerBoard({ item }: { item: Extract<PlayerShow, { kind: 'board' }> }) {
  return (
    <div className="h-full w-full self-start overflow-auto">
      <h1 className="mb-4 text-center font-serif text-2xl font-bold">{item.name}</h1>
      <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
        {item.cards.map(({ card, title, entity }) => (
          <section
            key={card.id}
            aria-label={title}
            className="mb-4 break-inside-avoid overflow-hidden rounded-lg border border-border bg-surface shadow-card"
          >
            <h2 className="bg-header px-3 py-1.5 font-serif font-bold text-header-fg">{title}</h2>
            <div className="p-3">
              <PlayerCardBody card={card} entity={entity} campaignId={item.campaignId} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function PlayerCardBody({
  card,
  entity,
  campaignId,
}: {
  card: BoardCard;
  entity: EntityDetail | undefined;
  campaignId: string | undefined;
}): ReactNode {
  switch (card.kind) {
    case 'entity':
      return entity ? (
        <EntityView type={entity.type} data={entity.data} edition={entity.edition} />
      ) : null;
    case 'image':
      return (
        <div className="h-[60vh]">
          <ImageBody src={card.src} caption={card.caption} campaignId={campaignId} />
        </div>
      );
    case 'text':
      return <p className="text-lg whitespace-pre-wrap">{card.text}</p>;
    case 'note':
      return campaignId ? <ShownNote campaignId={campaignId} path={card.path} bare /> : null;
    case 'initiative':
      return (
        <ol className="space-y-1 text-lg">
          <li className="text-sm font-semibold text-muted uppercase">Round {card.round}</li>
          {sortInitiative(card.rows).map((r, i) => (
            <li
              key={r.id}
              className={i === card.turn ? 'rounded bg-accent-soft px-2 font-bold' : 'px-2'}
            >
              {r.name}
            </li>
          ))}
        </ol>
      );
    case 'timer':
      return (
        <PlayerTimer seconds={card.seconds} elapsed={card.elapsed} startedAt={card.startedAt} />
      );
    case 'map':
      return (
        <div className="h-[60vh] p-3">
          <MapBody card={card} />
        </div>
      );
    case 'npc':
      return (
        <div className="space-y-1 text-lg">
          <p className="text-muted">
            A {card.npc.age} {card.npc.species.toLowerCase()} {card.npc.gender},{' '}
            {card.npc.occupation}
          </p>
          <p>{card.npc.appearance}</p>
          <p>
            {card.npc.personality}; {card.npc.voice}.
          </p>
        </div>
      );
    default:
      return null;
  }
}

function PlayerTimer({
  seconds,
  elapsed,
  startedAt,
}: {
  seconds: number;
  elapsed: number;
  startedAt?: number | undefined;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (startedAt === undefined) return;
    const t = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      clearInterval(t);
    };
  }, [startedAt]);
  const left = timerLeft(
    { seconds, elapsed, ...(startedAt !== undefined ? { startedAt } : {}) },
    startedAt !== undefined ? now : 0,
  );
  return (
    <p className="text-center font-mono text-6xl font-bold tabular-nums">
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </p>
  );
}
