/// <reference lib="webworker" />
/**
 * The data worker owns the 5etools index (SQLite in OPFS) so downloads, indexing and queries
 * never block the UI. The UI talks to it through `DataWorkerApi` via Comlink.
 */
import {
  checkReferences,
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
  type InstallResult,
  type SqlDatabase,
} from '@boh/data5e';
import { openMemoryDatabase, openOpfsDatabase } from '@boh/data5e/sqlite';
import * as Comlink from 'comlink';
import { unzipSync } from 'fflate';
import type { DataStatus, DataWorkerApi, InstallSummary, LocalFile } from './protocol';

let storage: DataStatus['storage'] = 'persistent';
let controller: AbortController | null = null;

const indexPromise: Promise<EntityIndex> = (async () => {
  let db: SqlDatabase;
  try {
    db = await openOpfsDatabase('5etools-index.sqlite3');
  } catch (error) {
    console.warn('OPFS unavailable; the 5etools index will only last this session.', error);
    storage = 'memory';
    db = await openMemoryDatabase();
  }
  return EntityIndex.open(db);
})();

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
    (await indexPromise).clear();
  },

  validateHomebrew(json) {
    return homebrewSources(json);
  },

  async syncHomebrew(packs) {
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

  async checkReferences(references) {
    return checkReferences(await indexPromise, references);
  },
};

Comlink.expose(api);
