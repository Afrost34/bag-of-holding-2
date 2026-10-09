import { GitHubError, syncStore, type SyncPlanSummary, type SyncResult } from '@boh/storage';
import { create } from 'zustand';
import { flushAnnotations, reloadAnnotations } from '../annotations/store';
import { useCalendar } from '../calendar/store';
import { reloadCampaigns } from '../campaigns/store';
import { useBoards } from '../boards/store';
import { useEncounters } from '../encounters/store';
import { useTables } from '../tables/store';
import { useStamps } from '../maps/assets';
import { useMaps } from '../maps/store';
import { usePictures } from '../pictures/store';
import { useCardSheets } from '../cards/store';
import { useCharacters } from '../characters/store';
import { useHomebrew } from '../data/homebrew';
import { returnWrites, syncedStore, takeWrites } from '../userStore';
import { isLazy } from './lazy';
import { remoteIdOf, repoFor, useSyncSettings } from './settings';

/**
 * Sync with the private data repository on GitHub (ADR 0006): this device's settings, its state,
 * and the automatic runs. The token never leaves this device and is never synced.
 */

export { repoFor, useSyncSettings, type SyncSettings } from './settings';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error';

interface SyncStore {
  status: SyncStatus;
  /** When the last sync finished (ms), on this device and in this session. */
  lastSync: number | null;
  lastResult: SyncResult | null;
  error: string | null;
  progress: { done: number; total: number } | null;
  /** What the sync under way sends and fetches. */
  plan: SyncPlanSummary | null;
  syncNow: () => Promise<void>;
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
/** The first sync of a session always looks at every file (edits may predate it). */
let fullSyncDone = false;

export const useSync = create<SyncStore>()((set) => ({
  status: useSyncSettings.getState().settings ? 'idle' : 'off',
  lastSync: null,
  lastResult: null,
  error: null,
  progress: null,
  plan: null,

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
        // The journal's code is loaded when first needed, not with the first screen.
        await (await import('../journal/store')).useJournal.getState().flush();
        await flushAnnotations();
        await useCharacters.getState().flush();
        await useCardSheets.getState().flush();
        await useBoards.getState().flush();
        await useEncounters.getState().flush();
        await useTables.getState().flush();
        await useMaps.getState().flush();
        // Only what the app wrote since the last sync counts: with nothing written and the
        // repository unchanged, the sync stops after one request.
        const written = takeWrites();
        let result: SyncResult;
        try {
          result = await syncStore(await syncedStore(), repoFor(settings), {
            localUnchanged: fullSyncDone && written === 0,
            onPlan: (plan) => {
              set({ plan });
            },
            remoteId: remoteIdOf(settings),
            lazy: isLazy,
            device: settings.device || 'a device',
            onProgress: (done, total) => {
              set({ progress: { done, total } });
            },
          });
        } catch (error) {
          returnWrites(written);
          throw error;
        }
        fullSyncDone = true;
        const changed = [...result.downloaded, ...result.deletedHere];
        if (changed.length > 0) await refreshAfterSync(changed);
        set({
          status: 'idle',
          lastSync: Date.now(),
          lastResult: result,
          progress: null,
          plan: null,
        });
      } catch (error) {
        set({ status: 'error', error: explain(error), progress: null, plan: null });
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
  if (touched(/^campaigns\/[^/]+\/note-types\.json$/)) {
    const { useNoteTypes } = await import('../journal/noteTypes');
    await useNoteTypes.getState().load(useNoteTypes.getState().campaignId);
  }
  if (touched(/^campaigns\/[^/]+\/journal\//)) {
    const [{ forgetAllAttachments }, { useJournal }] = await Promise.all([
      import('../journal/attachments'),
      import('../journal/store'),
    ]);
    forgetAllAttachments();
    await useJournal.getState().refresh();
  }
  if (touched(/^homebrew\//)) await useHomebrew.getState().load();
  if (touched(/^(characters\/|campaigns\/[^/]+\/characters\/)/))
    await useCharacters.getState().reload();
  if (touched(/^(card-sheets\/|campaigns\/[^/]+\/card-sheets\/)/))
    await useCardSheets.getState().reload();
  if (touched(/^(boards\/|campaigns\/[^/]+\/boards\/)/)) await useBoards.getState().reload();
  if (touched(/^(encounters\/|campaigns\/[^/]+\/encounters\/)/))
    await useEncounters.getState().reload();
  if (touched(/^(tables\/|campaigns\/[^/]+\/tables\/)/)) await useTables.getState().reload();
  if (touched(/^(maps\/|campaigns\/[^/]+\/maps\/)[^/]+\.json$/)) await useMaps.getState().reload();
  if (touched(/^stamps\//) && useStamps.getState().loaded) await useStamps.getState().load();
  if (touched(/^pictures\//) && usePictures.getState().loaded) await usePictures.getState().load();
  if (touched(/^campaigns\/[^/]+\/calendar\.json$/)) await useCalendar.getState().reload();
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
