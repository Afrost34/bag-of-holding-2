import type { SourceSummary } from '@boh/data5e';
import { create } from 'zustand';
import { dataWorker } from './client';

interface SourceListStore {
  sources: SourceSummary[];
  load: () => Promise<void>;
}

/** Every source in the index (official and homebrew), with entity counts. */
export const useSourceList = create<SourceListStore>()((set) => ({
  sources: [],
  load: async () => {
    set({ sources: await dataWorker().sources() });
  },
}));

export type SourceGroupId =
  | 'core2024'
  | 'core2014'
  | 'supplement'
  | 'setting'
  | 'adventure'
  | 'playtest'
  | 'homebrew'
  | 'other';

export const SOURCE_GROUPS: { id: SourceGroupId; label: string }[] = [
  { id: 'core2024', label: 'Core rules (2024)' },
  { id: 'core2014', label: 'Core rules (2014)' },
  { id: 'supplement', label: 'Supplements' },
  { id: 'setting', label: 'Campaign settings' },
  { id: 'adventure', label: 'Adventures' },
  { id: 'homebrew', label: 'Homebrew' },
  { id: 'playtest', label: 'Playtest & Unearthed Arcana' },
  { id: 'other', label: 'Other' },
];

export function sourceGroup(source: SourceSummary): SourceGroupId {
  if (source.kind === 'homebrew') return 'homebrew';
  if (source.playtest) return 'playtest';
  if (source.kind === 'adventure') return 'adventure';
  if (source.group === 'core') return source.edition === '2024' ? 'core2024' : 'core2014';
  if (source.group.startsWith('supplement')) return 'supplement';
  if (source.group.startsWith('setting')) return 'setting';
  return 'other';
}
