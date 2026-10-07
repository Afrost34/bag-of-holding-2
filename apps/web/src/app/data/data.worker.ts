/// <reference lib="webworker" />
/**
 * The data worker owns the 5etools index (SQLite in OPFS) so downloads, indexing and queries
 * never block the UI. The UI talks to it through `DataWorkerApi` via Comlink.
 */
import {
  categoryById,
  checkReferences,
  type ListRow,
  EntityIndex,
  GitHubDataSource,
  homebrewSources,
  installData,
  latestReleaseTag,
  LocalDataSource,
  META,
  normaliseLocalPath,
  syncHomebrew,
  versionFromPackageJson,
  type EntityDetail,
  type InstallResult,
  type SqlDatabase,
} from '@boh/data5e';
import { openMemoryDatabase, openOpfsDatabase } from '@boh/data5e/sqlite';
import * as Comlink from 'comlink';
import { unzipSync } from 'fflate';
import {
  buildCharacter,
  computeSheet,
  FOUNDRY_FILE,
  makeRulesData,
  optionsFor,
  type OptionCatalog,
  type RulesData,
} from '@boh/rules';
import type { DataStatus, DataWorkerApi, InstallSummary, LocalFile } from './protocol';

let storage: DataStatus['storage'] = 'persistent';
let controller: AbortController | null = null;

/**
 * Only one worker per browser profile may open the database: SQLite's OPFS "SAH pool" takes
 * exclusive file handles, and a second opener can fail or damage the pool. An exclusive Web Lock,
 * held for the worker's whole life, guarantees that. Other tabs wait for it and report `busy`.
 */
const DB_LOCK = 'boh-5etools-index';

function holdLock(ifAvailable: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    void navigator.locks.request(DB_LOCK, { ifAvailable }, (lock) => {
      if (!lock) {
        resolve(false);
        return undefined;
      }
      resolve(true);
      // Never settles: the lock is released when this worker (its tab) goes away.
      return new Promise<void>(() => undefined);
    });
  });
}

/** Settles once we know whether this worker owns the database or must wait for another tab. */
let markLockChecked: () => void = () => undefined;
const lockChecked = new Promise<void>((resolve) => {
  markLockChecked = resolve;
});

async function openIndex(): Promise<EntityIndex> {
  let db: SqlDatabase;
  try {
    const owned = !('locks' in navigator) || (await holdLock(true));
    if (!owned) storage = 'busy';
    markLockChecked();
    if (!owned) {
      await holdLock(false); // wait until the other tab or window closes
      storage = 'persistent';
    }
    db = await openOpfsDatabase('5etools-index.sqlite3');
  } catch (error) {
    markLockChecked();
    console.warn('OPFS unavailable; the 5etools index will only last this session.', error);
    storage = 'memory';
    db = await openMemoryDatabase();
  }
  const index = EntityIndex.open(db);
  // Installs made before an app update may lack derived data (generated magic item variants);
  // this is a no-op when it is already up to date.
  if (index.getMeta(META.version) !== undefined) {
    index.regenerateItemVariants(index.extractContext());
  }
  return index;
}

const indexPromise: Promise<EntityIndex> = openIndex();
let readyIndex: EntityIndex | null = null;

/** List rows are built once per category and reused until the data changes. */
const rowCache = new Map<string, ListRow[]>();

/** Rules data and option lists, built once per index state (cleared with the row cache). */
let rulesCache: { data: RulesData; catalog: OptionCatalog } | null = null;
const typeCache = new Map<string, EntityDetail[]>();

async function rules(): Promise<{ data: RulesData; catalog: OptionCatalog }> {
  const index = await indexPromise;
  if (rulesCache) return rulesCache;
  const data = makeRulesData(index.lookup, {
    classFeature: index.getAux(FOUNDRY_FILE, 'classFeature'),
    subclassFeature: index.getAux(FOUNDRY_FILE, 'subclassFeature'),
  });
  const spellClasses = index.spellClasses();
  rulesCache = {
    data,
    catalog: {
      get: (key) => index.getEntity(key),
      ofType: (type) => {
        let list = typeCache.get(type);
        if (!list) {
          list = index.ofType(type);
          typeCache.set(type, list);
        }
        return list;
      },
      spellClasses,
    },
  };
  return rulesCache;
}

/** Forgets cached rows, option lists and rules data after the index changed. */
function clearCaches(): void {
  rowCache.clear();
  typeCache.clear();
  rulesCache = null;
}
void indexPromise.then((index) => {
  readyIndex = index;
});

function summarize(result: InstallResult): InstallSummary {
  return {
    version: result.version,
    added: result.plan.added,
    changed: result.plan.changed,
    removed: result.plan.removed.length,
    durationMs: result.durationMs,
    warnings: [
      ...result.issues.map((i) => `${i.file}: ${i.detail}`),
      ...result.skipped.map((s) => `Duplicate skipped: ${s}`),
      ...result.copyErrors,
    ],
  };
}

async function runInstall(
  run: (index: EntityIndex, signal: AbortSignal) => Promise<InstallResult>,
): Promise<InstallSummary> {
  if (controller) throw new Error('An install is already running.');
  controller = new AbortController();
  try {
    return summarize(await run(await indexPromise, controller.signal));
  } finally {
    controller = null;
    clearCaches();
  }
}

/** Expands a picked .zip into its files; passes folder files through. */
async function readLocalFiles(files: LocalFile[]): Promise<[string, Uint8Array][]> {
  const zip = files.length === 1 && files[0]?.path.toLowerCase().endsWith('.zip') ? files[0] : null;
  if (zip) {
    const entries = unzipSync(new Uint8Array(await zip.file.arrayBuffer()), {
      filter: (f) => {
        const path = normaliseLocalPath(f.name);
        return (
          f.name.endsWith('package.json') ||
          path?.endsWith('.json') === true ||
          f.name.endsWith('parser.js')
        );
      },
    });
    return Object.entries(entries);
  }
  return Promise.all(
    files.map(async (f): Promise<[string, Uint8Array]> => [
      f.path,
      new Uint8Array(await f.file.arrayBuffer()),
    ]),
  );
}

const api: DataWorkerApi = {
  async status() {
    await lockChecked;
    if (!readyIndex && storage === 'busy') {
      return { storage, installed: false, entities: 0, types: {} };
    }
    const index = await indexPromise;
    const version = index.getMeta(META.version);
    const origin = index.getMeta(META.origin);
    const installedAt = index.getMeta(META.installedAt);
    const interrupted = index.getMeta(META.inProgress);
    return {
      storage,
      installed: version !== undefined,
      ...(version ? { version } : {}),
      ...(origin ? { origin } : {}),
      ...(installedAt ? { installedAt } : {}),
      ...(interrupted ? { interrupted } : {}),
      entities: index.totalEntities(),
      types: index.countsByType(),
    };
  },

  async checkForUpdate(repo) {
    const index = await indexPromise;
    const latest = await latestReleaseTag(repo);
    const installed = index.getMeta(META.version);
    return {
      latest,
      ...(installed ? { installed } : {}),
      updateAvailable: installed !== latest || index.getMeta(META.inProgress) !== undefined,
    };
  },

  installFromGitHub(repo, version, onProgress) {
    return runInstall((index, signal) =>
      installData(index, new GitHubDataSource(repo, version), { signal, onProgress }),
    );
  },

  installFromFiles(files, onProgress) {
    return runInstall(async (index, signal) => {
      const entries = await readLocalFiles(files);
      const pkg = entries.find(
        ([path]) => /(^|\/)package\.json$/.test(path) && !path.includes('node_modules'),
      );
      const source = new LocalDataSource(entries, versionFromPackageJson(pkg?.[1]));
      if (source.size === 0) {
        throw new Error(
          'No 5etools data found. Pick the 5etools folder (the one containing "data") or its .zip.',
        );
      }
      return installData(index, source, { signal, onProgress });
    });
  },

  cancelInstall() {
    controller?.abort();
  },

  async clear() {
    clearCaches();
    (await indexPromise).clear();
  },

  validateHomebrew(json) {
    return homebrewSources(json);
  },

  async syncHomebrew(packs) {
    clearCaches();
    return syncHomebrew(await indexPromise, packs);
  },

  async sources() {
    return (await indexPromise).listSources();
  },

  async search(text, options) {
    return (await indexPromise).search(text, options);
  },

  async entity(key) {
    return (await indexPromise).getEntity(key);
  },

  async listRows(categoryId) {
    const category = categoryById(categoryId);
    if (!category) return [];
    let rows = rowCache.get(categoryId);
    if (!rows) {
      rows = (await indexPromise).listRows(category);
      rowCache.set(categoryId, rows);
    }
    return rows;
  },

  async library(kind) {
    return (await indexPromise).library(kind);
  },

  async bookContent(kind, id) {
    return (await indexPromise).bookContent(kind, id);
  },

  async classPage(key) {
    return (await indexPromise).classPage(key);
  },

  async subclassPage(key) {
    return (await indexPromise).subclassPage(key);
  },

  async speciesPage(key) {
    return (await indexPromise).speciesPage(key);
  },

  async specificVariants(key) {
    return (await indexPromise).specificVariantsOf(key);
  },

  async resolve(candidateLists) {
    const index = await indexPromise;
    return candidateLists.map((c) => index.resolveCandidates(c) ?? null);
  },

  async checkReferences(references) {
    return checkReferences(await indexPromise, references);
  },

  async character(decisions, campaignRules) {
    const { data } = await rules();
    const built = buildCharacter(data, decisions, campaignRules);
    const sheet = computeSheet(data, decisions, built);
    const { entities, ...rest } = built;
    return {
      ...rest,
      entities: [...entities.values()].map(({ data: _data, ...summary }) => summary),
      sheet,
    };
  },

  async choiceOptions(decisions, choiceId, campaignRules) {
    const { data, catalog } = await rules();
    const built = buildCharacter(data, decisions, campaignRules);
    const choice = built.choices.find((c) => c.id === choiceId);
    return choice ? optionsFor(choice, built, catalog) : [];
  },
};

Comlink.expose(api);
