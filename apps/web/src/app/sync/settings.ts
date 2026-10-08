import { GitHubRepo } from '@boh/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** This device's sync settings (the token never leaves the device and is never synced). */

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

export function repoFor(settings: SyncSettings): GitHubRepo {
  const [owner = '', repo = ''] = settings.repository.split('/');
  return new GitHubRepo({ owner, repo, branch: settings.branch, token: settings.token });
}

/** The repository the sync's bookkeeping belongs to. */
export const remoteIdOf = (settings: SyncSettings) => `${settings.repository}@${settings.branch}`;
