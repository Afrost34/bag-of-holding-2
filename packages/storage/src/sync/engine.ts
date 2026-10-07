import type { FileStore } from '../types';
import { planSync, resolveConflict } from './plan';
import { blobSha, type RemoteRepo } from './remote';

/**
 * Two-way sync of a store with a Git repository (ADR 0006). Each run compares the files with how
 * they were at the last sync, copies changes each way, and commits this device's changes in one
 * commit. When both sides changed a file, the newer edit wins and the other version is kept in
 * the repository's history.
 */

/** Sync bookkeeping, kept in the store but never synced. */
export const SYNC_DIR = '.sync';
const STATE_FILE = `${SYNC_DIR}/state.json`;

interface SyncState {
  version: 1;
  /** The repository the state belongs to (`owner/repo@branch`): a new one starts afresh. */
  remote: string;
  /** Every file as it was after the last sync: path → blob hash. */
  files: Record<string, string>;
}

export interface SyncResult {
  downloaded: string[];
  uploaded: string[];
  deletedHere: string[];
  deletedThere: string[];
  /** Files both sides changed, and which side won. */
  conflicts: { path: string; winner: 'local' | 'remote' }[];
  /** The commit made, or null when this device had nothing to send. */
  commit: string | null;
}

export interface SyncOptions {
  /** Identifies the repository, so its state is not mixed with another one's. */
  remoteId: string;
  /** Names this device in commit messages, e.g. "phone". */
  device: string;
  onProgress?: (done: number, total: number) => void;
  /** Files never synced (besides the sync's own folder). */
  ignore?: (path: string) => boolean;
}

async function walk(store: FileStore, dir = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await store.list(dir)) {
    if (entry.kind === 'directory') out.push(...(await walk(store, entry.path)));
    else out.push(entry.path);
  }
  return out;
}

async function readState(store: FileStore, remoteId: string): Promise<SyncState> {
  const fresh: SyncState = { version: 1, remote: remoteId, files: {} };
  const text = await store.readText(STATE_FILE);
  if (!text) return fresh;
  try {
    const state = JSON.parse(text) as Partial<SyncState> | null;
    return state?.version === 1 && state.remote === remoteId && state.files
      ? { version: 1, remote: remoteId, files: state.files }
      : fresh;
  } catch {
    return fresh;
  }
}

/** Runs `tasks` a few at a time (network calls), keeping their order in the result. */
async function pool<T>(items: readonly T[], size: number, task: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await task(item);
    }
  });
  await Promise.all(workers);
}

export async function syncStore(
  store: FileStore,
  repo: RemoteRepo,
  options: SyncOptions,
  attempt = 1,
): Promise<SyncResult> {
  const ignored = (p: string) =>
    p === SYNC_DIR || p.startsWith(`${SYNC_DIR}/`) || options.ignore?.(p) === true;
  const state = await readState(store, options.remoteId);

  // This device: every file's hash and age.
  const localPaths = (await walk(store)).filter((p) => !ignored(p));
  const local: Record<string, string> = {};
  const localBytes = new Map<string, Uint8Array>();
  for (const path of localPaths) {
    const bytes = await store.readFile(path);
    if (!bytes) continue;
    localBytes.set(path, bytes);
    local[path] = await blobSha(bytes);
  }

  // The repository.
  let head = await repo.head();
  if (!head) {
    await repo.init();
    head = await repo.head();
    if (!head) throw new Error('The repository could not be started');
  }
  const remoteAll = await repo.tree(head.tree);
  const remote = Object.fromEntries(Object.entries(remoteAll).filter(([p]) => !ignored(p)));

  const plan = planSync(state.files, local, remote);
  const download = [...plan.download];
  const upload = [...plan.upload];
  const deleteLocal = [...plan.deleteLocal];
  const deleteRemote = [...plan.deleteRemote];
  const conflicts: SyncResult['conflicts'] = [];
  /** Local versions that lost: committed once before the winner, so history keeps them. */
  const losers: string[] = [];
  for (const path of plan.conflicts) {
    const winner = resolveConflict(
      { exists: path in local, time: await store.modified(path) },
      { exists: path in remote, time: path in remote ? await repo.lastChange(path) : null },
    );
    conflicts.push({ path, winner });
    if (winner === 'local') {
      if (path in local) upload.push(path);
      else deleteRemote.push(path);
    } else if (path in remote) {
      download.push(path);
      if (path in local) losers.push(path);
    } else {
      deleteLocal.push(path);
    }
  }

  const total = download.length + upload.length + losers.length;
  let done = 0;
  const tick = () => {
    done++;
    options.onProgress?.(done, total);
  };

  // Send this device's changes first: if another device moved the branch meanwhile, nothing
  // here has changed yet and the whole sync simply runs again.
  const uploaded: Record<string, string> = {};
  await pool([...upload, ...losers], 4, async (path) => {
    const bytes = localBytes.get(path);
    if (bytes) uploaded[path] = await repo.writeBlob(bytes);
    tick();
  });

  let commit: string | null = null;
  const finalRemote = new Map(Object.entries(remote));
  if (upload.length > 0 || deleteRemote.length > 0 || losers.length > 0) {
    let parent = head.commit;
    let baseTree = head.tree;
    if (losers.length > 0) {
      baseTree = await repo.writeTree(
        head.tree,
        losers.map((path) => ({ path, sha: uploaded[path] ?? null })),
      );
      parent = await repo.writeCommit(
        `Keep the ${options.device}'s version of ${losers.join(', ')} (a newer edit won)`,
        baseTree,
        [parent],
      );
    }
    const changes = [
      ...upload.map((path) => ({ path, sha: uploaded[path] ?? null })),
      ...deleteRemote.map((path) => ({ path, sha: null })),
      // After the kept versions, the files that lost go back to the winning version.
      ...losers.map((path) => ({ path, sha: remote[path] ?? null })),
    ];
    const tree = await repo.writeTree(baseTree, changes);
    const message = `Sync from ${options.device}: ${[
      upload.length ? `${String(upload.length)} changed` : '',
      deleteRemote.length ? `${String(deleteRemote.length)} deleted` : '',
    ]
      .filter(Boolean)
      .join(', ')}`;
    commit = await repo.writeCommit(message, tree, [parent]);
    if (!(await repo.moveBranch(commit, head.commit))) {
      if (attempt >= 3) throw new Error('The repository kept changing during the sync; try again');
      return syncStore(store, repo, options, attempt + 1);
    }
    for (const path of upload) finalRemote.set(path, uploaded[path] ?? '');
    for (const path of deleteRemote) finalRemote.delete(path);
  }

  // Then bring the repository's changes here.
  await pool(download, 4, async (path) => {
    const sha = remote[path];
    if (sha) await store.writeFile(path, await repo.readBlob(sha));
    tick();
  });
  for (const path of deleteLocal) await store.remove(path);

  await store.writeFile(
    STATE_FILE,
    JSON.stringify({
      version: 1,
      remote: options.remoteId,
      files: Object.fromEntries(finalRemote),
    } satisfies SyncState),
  );

  return {
    downloaded: download,
    uploaded: upload,
    deletedHere: deleteLocal,
    deletedThere: deleteRemote,
    conflicts,
    commit,
  };
}
