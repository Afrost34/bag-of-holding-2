import { MemoryFileStore } from '@boh/storage';
import { describe, expect, it, vi } from 'vitest';
import { docStore, type Doc } from './docStore';

const files = new MemoryFileStore();
vi.mock('./userStore', () => ({ userStore: () => Promise.resolve(files) }));

interface Note extends Doc {
  text: string;
}

const NOTE_FILES = {
  one: 'a note',
  many: 'notes',
  dir: (campaign?: string) => (campaign ? `campaigns/${campaign}/notes` : 'notes'),
  path: (id: string, campaign?: string) =>
    `${campaign ? `campaigns/${campaign}/notes` : 'notes'}/${id}.json`,
  parse: (text: string | null, id: string, campaign?: string): Note | null => {
    if (!text) return null;
    const json = JSON.parse(text) as Omit<Note, 'id' | 'campaign'>;
    return { ...json, id, ...(campaign ? { campaign } : {}) };
  },
  serialize: ({ id: _i, campaign: _c, ...rest }: Note) => JSON.stringify(rest),
  alongside: (n: Note) => [`notes/${n.id}.txt`],
};

function makeStore() {
  let docs: Note[] = [];
  let loaded = false;
  const store = docStore<Note>(NOTE_FILES, {
    get: () => docs,
    set: (next, isLoaded) => {
      docs = next;
      if (isLoaded) loaded = true;
    },
  });
  return { store, docs: () => docs, loaded: () => loaded };
}

describe('document stores', () => {
  it('read the library and every campaign once, by name', async () => {
    await files.writeFile(
      'notes/b.json',
      JSON.stringify({ name: 'Beta', text: '', updatedAt: '' }),
    );
    await files.writeFile(
      'campaigns/rust/notes/a.json',
      JSON.stringify({ name: 'Alpha', text: '', updatedAt: '' }),
    );
    await files.writeFile('campaigns/rust/campaign.json', '{}');
    const { store, docs, loaded } = makeStore();
    await store.actions.load();
    expect(loaded()).toBe(true);
    expect(docs().map((d) => [d.name, d.campaign])).toEqual([
      ['Alpha', 'rust'],
      ['Beta', undefined],
    ]);
    // A second load waits for the same read and does not replace what changed since.
    store.actions.save({ ...docs()[0], text: 'changed' } as Note);
    await store.actions.load();
    expect(docs()[0]?.text).toBe('changed');
  });

  it('write saves, new documents, and remove what goes with them', async () => {
    const { store, docs } = makeStore();
    await store.actions.load();
    const added = await store.add({ id: 'c', name: 'Gamma', text: 'hi', updatedAt: '' });
    expect(docs().map((d) => d.id)).toContain('c');
    expect(await files.readText('notes/c.json')).toContain('Gamma');
    store.actions.save({ ...added, text: 'bye' });
    await store.actions.flush();
    expect(await files.readText('notes/c.json')).toContain('bye');
    await files.writeFile('notes/c.txt', 'thumb');
    await store.actions.remove('c');
    expect(await files.readText('notes/c.json')).toBeNull();
    expect(await files.readText('notes/c.txt')).toBeNull();
    expect(docs().map((d) => d.id)).not.toContain('c');
  });

  it('read files again after a sync', async () => {
    const { store, docs } = makeStore();
    await store.actions.load();
    await files.writeFile(
      'notes/d.json',
      JSON.stringify({ name: 'Delta', text: '', updatedAt: '' }),
    );
    await store.actions.reload();
    expect(docs().map((d) => d.name)).toContain('Delta');
  });
});
