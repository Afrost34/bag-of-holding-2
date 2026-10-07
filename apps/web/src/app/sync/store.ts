import { GitHubError, GitHubRepo, syncStore, type SyncResult } from '@boh/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { flushAnnotations, reloadAnnotations } from '../annotations/store';
import { reloadCampaigns } from '../campaigns/store';
import { useCharacters } from '../characters/store';
import { useHomebrew } from '../data/homebrew';
import { forgetAllAttachments } from '../journal/attachments';
import { useJournal } from '../journal/store';
import { userStore } from '../userStore';

/**
 * Sync with the private data repository on GitHub (ADR 0006): this device's settings, its state,
 * and the automatic runs. The token never leaves this device and is never synced.
 */

export interface SyncSettings {
  /** `owner/name` of the data repository. */
  repository: string;
  branch: string;
  token: string;
  /** This device's name in the repository's history ("PC", "phone"…). */
  device: string;
}

interface SyncSettingsStore {
  settings: SyncSettings | null;
  setSettings: (settings: SyncSettings | null) => void;
}

export const useSyncSettings = create<SyncSettingsStore>()(
  persist(
    (set) => ({
      settings: null,
      setSettings: (settings) => {
        set({ settings });
      },
    }),
    { name: 'boh.sync', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error';

interface SyncStore {
  status: SyncStatus;
  /** When the last sync finished (ms), on this device and in this session. */
  lastSync: number | null;
  lastResult: SyncResult | null;
  error: string | null;
  progress: { done: number; total: number } | null;
  syncNow: () => Promise<void>;
}

export function repoFor(settings: SyncSettings): GitHubRepo {
  const [owner = '', repo = ''] = settings.repository.split('/');
  return new GitHubRepo({ owner, repo, branch: settings.branch, token: settings.token });
}

/** A message people can act on, from what GitHub answered. */
export function explain(error: unknown): string {
  if (error instanceof GitHubError) {
    if (error.status === 401)
      return 'GitHub did not accept the token. It may have expired: make a new one.';
    if (error.status === 403)
      return 'The token may not change this repository. Give it "Contents: read and write".';
    if (error.status === 404)
      return 'Repository not found. Check its name, and that the token may see it.';
    return `GitHub: ${error.message}`;
  }
  if (error instanceof TypeError) return 'No connection to GitHub right now.';
  return error instanceof Error ? error.message : String(error);
}

let running: Promise<void> | null = null;

export const useSync = create<SyncStore>()((set) => ({
  status: useSyncSettings.getState().settings ? 'idle' : 'off',
  lastSync: null,
  lastResult: null,
  error: null,
  progress: null,

  syncNow: () => {
    running ??= (async () => {
      const settings = useSyncSettings.getState().settings;
      if (!settings) {
        set({ status: 'off' });
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        set({ status: 'offline' });
        return;
      }
      set({ status: 'syncing', error: null, progress: null });
      try {
        // Everything typed so far goes along.
        await useJournal.getState().flush();
        await flushAnnotations();
        await useCharacters.getState().flush();
        const result = await syncStore(await userStore(), repoFor(settings), {
          remoteId: `${settings.repository}@${settings.branch}`,
          device: settings.device || 'a device',
          onProgress: (done, total) => {
            set({ progress: { done, total } });
          },
        });
        const changed = [...result.downloaded, ...result.deletedHere];
        if (changed.length > 0) await refreshAfterSync(changed);
        set({ status: 'idle', lastSync: Date.now(), lastResult: result, progress: null });
      } catch (error) {
        set({ status: 'error', error: explain(error), progress: null });
      }
    })().finally(() => {
      running = null;
    });
    return running;
  },
}));

/** What is on screen is read again where the sync changed files. */
async function refreshAfterSync(paths: string[]): Promise<void> {
  const touched = (prefix: RegExp) => paths.some((p) => prefix.test(p));
  if (touched(/^(campaigns\/[^/]+\/campaign\.json|templates\/)/)) await reloadCampaigns();
  if (touched(/annotations\.json$/)) await reloadAnnotations();
  if (touched(/^campaigns\/[^/]+\/journal\//)) {
    forgetAllAttachments();
    await useJournal.getState().refresh();
  }
  if (touched(/^homebrew\//)) await useHomebrew.getState().load();
  if (touched(/^(characters\/|campaigns\/[^/]+\/characters\/)/))
    await useCharacters.getState().reload();
}

const EVERY_MS = 3 * 60 * 1000;
let started = false;

/**
 * Syncs when the app starts, every few minutes while it is open, when it comes back to the
 * front, when the connection returns, and when it is put away.
 */
export function startAutoSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const run = () => {
    if (useSyncSettings.getState().settings) void useSync.getState().syncNow();
  };
  run();
  window.setInterval(() => {
    if (document.visibilityState === 'visible') run();
  }, EVERY_MS);
  document.addEventListener('visibilitychange', run);
  window.addEventListener('online', run);
  useSyncSettings.subscribe((s, prev) => {
    if (s.settings !== prev.settings) {
      useSync.setState({ status: s.settings ? 'idle' : 'off', error: null });
      if (s.settings) run();
    }
  });
}
