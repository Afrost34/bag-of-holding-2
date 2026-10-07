import type { EntityDetail } from '@boh/data5e';
import { EntityView } from '@boh/renderer';
import { useEffect } from 'react';
import { usePlayerShow, type PlayerShow } from '../../app/boards/player';
import { useCampaigns } from '../../app/campaigns/store';
import { NoteViewer } from '../../app/journal/notes/NoteViewer';
import { useJournal } from '../../app/journal/store';
import { ImageBody } from './bodies';
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

function ShownNote({ campaignId, path }: { campaignId: string; path: string }) {
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
        <h1 className="mb-3 font-serif text-3xl font-bold">
          {path.split('/').pop()?.replace(/\.md$/i, '')}
        </h1>
        {text !== undefined && campaign && <NoteViewer key={text} text={text} />}
      </article>
    </NotesProvider>
  );
}
