import type { SourceInfo } from '@boh/data5e';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Which sources are on, as overrides of the default (everything except playtest material).
 * Campaigns get their own source lists in M4; this is the app-wide default.
 * New sources from a 5etools update follow the default until the user flips them.
 */
interface SourcePrefs {
  overrides: Record<string, boolean>;
  setEnabled: (ids: readonly string[], enabled: boolean) => void;
  reset: () => void;
}

export const useSourcePrefs = create<SourcePrefs>()(
  persist(
    (set) => ({
      overrides: {},
      setEnabled: (ids, enabled) => {
        set((s) => {
          const overrides = { ...s.overrides };
          for (const id of ids) overrides[id.toLowerCase()] = enabled;
          return { overrides };
        });
      },
      reset: () => {
        set({ overrides: {} });
      },
    }),
    { name: 'boh.sources', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export function isSourceEnabled(
  source: Pick<SourceInfo, 'id' | 'playtest'>,
  overrides: Record<string, boolean>,
): boolean {
  return overrides[source.id.toLowerCase()] ?? !source.playtest;
}

/** Sources the user turned off. Safe before the source list loads: nothing is excluded. */
export function disabledSourceIds(
  sources: readonly Pick<SourceInfo, 'id' | 'playtest'>[],
  overrides: Record<string, boolean>,
): string[] {
  return sources.filter((s) => !isSourceEnabled(s, overrides)).map((s) => s.id);
}

export function enabledSourceIds(
  sources: readonly Pick<SourceInfo, 'id' | 'playtest'>[],
  overrides: Record<string, boolean>,
): string[] {
  return sources.filter((s) => isSourceEnabled(s, overrides)).map((s) => s.id);
}
