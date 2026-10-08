import { CAMPAIGNS_DIR } from './campaigns/model';
import { userStore } from './userStore';

/**
 * What every store of one-file-per-document user data shares (boards, maps, encounters, roll
 * tables, card sheets, characters): every document of the library and of each campaign is read
 * once and kept in memory; each change is written back at once (files are small), one write
 * after another, the latest version of each document only; leaving the page writes what is
 * pending right away.
 *
 *   <dir>/<id>.json                       documents kept outside any campaign
 *   campaigns/<campaign>/<dir>/<id>.json  a campaign's documents
 */

export interface Doc {
  id: string;
  name: string;
  updatedAt: string;
  /** Not stored: it is where the file is. */
  campaign?: string;
}

export interface DocFiles<D extends Doc> {
  /** For messages: "a map", "maps". */
  one: string;
  many: string;
  dir: (campaign?: string) => string;
  path: (id: string, campaign?: string) => string;
  parse: (text: string | null, id: string, campaign?: string) => D | null;
  serialize: (doc: D) => string;
  /** Other files that go with a document and are removed with it (a map's thumbnail). */
  alongside?: (doc: D) => string[];
}

/** The part of a store's state the shared actions read and write. */
export interface DocList<D> {
  get: () => readonly D[];
  set: (docs: D[], loaded?: true) => void;
}

/** By name, as every list shows them. */
export const sortByName = <D extends { name: string }>(list: readonly D[]): D[] =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, 'en'));

/** A document of a campaign (or of the library, with no campaign). */
export const inCampaign = <D extends Doc>(doc: D, campaign: string | undefined): D =>
  campaign ? { ...doc, campaign } : doc;

export function docStore<D extends Doc>(files: DocFiles<D>, list: DocList<D>) {
  const pending = new Map<string, D>();
  let writing: Promise<void> = Promise.resolve();
  let loading: Promise<void> | null = null;

  async function readDir(campaign?: string): Promise<D[]> {
    const store = await userStore();
    const out: D[] = [];
    for (const entry of await store.list(files.dir(campaign))) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
      const doc = files.parse(await store.readText(entry.path), entry.name.slice(0, -5), campaign);
      if (doc) out.push(doc);
    }
    return out;
  }

  async function readAll(): Promise<D[]> {
    const store = await userStore();
    const campaigns = (await store.list(CAMPAIGNS_DIR)).filter((e) => e.kind === 'directory');
    const lists = await Promise.all([readDir(), ...campaigns.map((c) => readDir(c.name))]);
    return sortByName(lists.flat());
  }

  /** Writes what is pending, after any write already under way. */
  function writeNow(): Promise<void> {
    writing = writing
      .then(async () => {
        const batch = [...pending.values()];
        pending.clear();
        if (batch.length === 0) return;
        const store = await userStore();
        for (const d of batch)
          await store.writeFile(files.path(d.id, d.campaign), files.serialize(d));
      })
      .catch((error: unknown) => {
        console.warn(`Could not save ${files.one}`, error);
      });
    return writing;
  }

  // Leaving the page (closing the tab, reloading, switching app on a phone) saves edits now.
  if (typeof document !== 'undefined') {
    const saveNow = () => {
      void writeNow();
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });
    window.addEventListener('pagehide', saveNow);
  }

  const load = (): Promise<void> => {
    loading ??= readAll()
      .then((docs) => {
        list.set(docs, true);
      })
      .catch((error: unknown) => {
        console.warn(`Could not load ${files.many}`, error);
        list.set([...list.get()], true);
      });
    return loading;
  };

  return {
    /** The ids in use (a new document's id must differ). */
    ids: () => list.get().map((d) => d.id),

    /** Writes a new document and adds it to the list. */
    add: async (doc: D): Promise<D> => {
      const store = await userStore();
      await store.writeFile(files.path(doc.id, doc.campaign), files.serialize(doc));
      list.set(sortByName([...list.get(), doc]));
      return doc;
    },

    /** The actions every such store has. */
    actions: {
      /** Reads every document once; later calls wait for the same read. */
      load,
      /** Reads every file again (after a sync brought changes). */
      reload: async () => {
        await writeNow();
        loading = null;
        await load();
      },
      /** Replaces a document in memory and writes it. */
      save: (doc: D) => {
        const next = { ...doc, updatedAt: new Date().toISOString() };
        list.set(sortByName(list.get().map((d) => (d.id === next.id ? next : d))));
        pending.set(next.id, next);
        void writeNow();
      },
      /** Writes pending saves now (before a sync, or when leaving). */
      flush: writeNow,
      remove: async (id: string) => {
        const doc = list.get().find((d) => d.id === id);
        if (!doc) return;
        pending.delete(id);
        const store = await userStore();
        await store.remove(files.path(id, doc.campaign));
        for (const p of files.alongside?.(doc) ?? []) await store.remove(p).catch(() => undefined);
        list.set(list.get().filter((d) => d.id !== id));
      },
    },
  };
}
