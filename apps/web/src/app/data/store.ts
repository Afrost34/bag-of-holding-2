import { DEFAULT_REPO, type InstallProgress } from '@boh/data5e';
import { create } from 'zustand';
import { dataWorker, proxy } from './client';
import type { DataStatus, InstallSummary, LocalFile, UpdateCheck } from './protocol';

interface DataStore {
  status: DataStatus | null;
  /** Live progress while an install or update runs. */
  progress: InstallProgress | null;
  lastInstall: InstallSummary | null;
  update: UpdateCheck | null;
  error: string | null;
  busy: boolean;

  refresh: () => Promise<void>;
  checkForUpdate: () => Promise<UpdateCheck | null>;
  /** Downloads the latest release (or resumes / updates to it). */
  installLatest: () => Promise<void>;
  installFromFiles: (files: LocalFile[]) => Promise<void>;
  cancel: () => void;
  clear: () => Promise<void>;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The 5etools data repo to download from. A setting later; the official mirror for now. */
export const DATA_REPO = DEFAULT_REPO;

/** Asks the browser not to evict our storage (phones evict non-persistent sites first). */
async function requestPersistence(): Promise<void> {
  try {
    // Not every browser has the Storage API (older Safari).
    if ('storage' in navigator && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Best effort only.
  }
}

export const useData = create<DataStore>()((set, get) => {
  const run = async (task: () => Promise<InstallSummary>) => {
    if (get().busy) return;
    set({ busy: true, error: null, progress: null, lastInstall: null });
    await requestPersistence();
    try {
      const summary = await task();
      set({ lastInstall: summary });
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ busy: false, progress: null, update: null });
      await get().refresh();
    }
  };
  const onProgress = proxy((progress: InstallProgress) => {
    set({ progress });
  });

  return {
    status: null,
    progress: null,
    lastInstall: null,
    update: null,
    error: null,
    busy: false,

    refresh: async () => {
      try {
        set({ status: await dataWorker().status() });
      } catch (error) {
        set({ error: message(error) });
      }
    },

    checkForUpdate: async () => {
      try {
        const update = await dataWorker().checkForUpdate(DATA_REPO);
        set({ update, error: null });
        return update;
      } catch (error) {
        set({ error: `Could not reach GitHub: ${message(error)}` });
        return null;
      }
    },

    installLatest: () =>
      run(async () => {
        const update = get().update ?? (await dataWorker().checkForUpdate(DATA_REPO));
        return dataWorker().installFromGitHub(DATA_REPO, update.latest, onProgress);
      }),

    installFromFiles: (files) => run(() => dataWorker().installFromFiles(files, onProgress)),

    cancel: () => {
      void dataWorker().cancelInstall();
    },

    clear: async () => {
      await dataWorker().clear();
      set({ lastInstall: null, update: null });
      await get().refresh();
    },
  };
});
