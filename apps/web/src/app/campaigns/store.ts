import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ROOT_ANNOTATIONS_FILE, switchAnnotationsFile } from '../annotations/store';
import { useSourcePrefs } from '../data/sourcePrefs';
import { userStore } from '../userStore';
import {
  BUILT_IN_TEMPLATES,
  campaignDir,
  campaignFile,
  CAMPAIGNS_DIR,
  newCampaign,
  parseCampaign,
  parseTemplate,
  serializeCampaign,
  serializeTemplate,
  templateFromCampaign,
  TEMPLATES_DIR,
  type Campaign,
  type CampaignTemplate,
} from './model';

/** Which campaign this device has open; each device can be on a different one. */
const useActiveCampaignId = create<{ activeId: string | null }>()(
  persist(() => ({ activeId: null as string | null }), {
    name: 'boh.campaign',
    version: 1,
    storage: createJSONStorage(() => localStorage),
  }),
);

interface CampaignsStore {
  campaigns: Campaign[];
  /** The user's own templates (built-in ones are in `BUILT_IN_TEMPLATES`). */
  templates: CampaignTemplate[];
  activeId: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  create: (name: string, templateId: string) => Promise<Campaign>;
  activate: (id: string) => Promise<void>;
  update: (
    id: string,
    patch: Partial<Pick<Campaign, 'name' | 'edition' | 'rules'>>,
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  saveTemplate: (campaignId: string, name: string) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
}

const SAVE_SOURCES_AFTER_MS = 400;
let loading: Promise<void> | null = null;
/** Set while the active campaign's sources are copied into the source toggles. */
let applyingSources = false;
let sourcesTimer: ReturnType<typeof setTimeout> | null = null;

async function writeCampaign(c: Campaign): Promise<void> {
  const store = await userStore();
  await store.writeFile(campaignFile(c.id), serializeCampaign(c));
}

async function readCampaigns(): Promise<Campaign[]> {
  const store = await userStore();
  const out: Campaign[] = [];
  for (const entry of await store.list(CAMPAIGNS_DIR)) {
    if (entry.kind !== 'directory') continue;
    const campaign = parseCampaign(await store.readText(campaignFile(entry.name)), entry.name);
    if (campaign) out.push(campaign);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

async function readTemplates(): Promise<CampaignTemplate[]> {
  const store = await userStore();
  const out: CampaignTemplate[] = [];
  for (const entry of await store.list(TEMPLATES_DIR)) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
    const template = parseTemplate(await store.readText(entry.path), entry.name.slice(0, -5));
    if (template) out.push(template);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** Points source toggles and notes at the active campaign (or the app-wide ones without one). */
async function applyActive(campaign: Campaign | undefined): Promise<void> {
  if (campaign) {
    applyingSources = true;
    useSourcePrefs.setState({ overrides: { ...campaign.sources } });
    applyingSources = false;
  }
  await switchAnnotationsFile(
    campaign ? `${campaignDir(campaign.id)}/annotations.json` : ROOT_ANNOTATIONS_FILE,
  );
}

/** Campaigns in the user's data, and the one open on this device. */
export const useCampaigns = create<CampaignsStore>()((set, get) => ({
  campaigns: [],
  templates: [],
  activeId: null,
  loaded: false,

  load: () => {
    loading ??= (async () => {
      const [campaigns, templates] = await Promise.all([readCampaigns(), readTemplates()]);
      const remembered = useActiveCampaignId.getState().activeId;
      const active = campaigns.find((c) => c.id === remembered) ?? campaigns[0];
      set({ campaigns, templates, activeId: active?.id ?? null, loaded: true });
      useActiveCampaignId.setState({ activeId: active?.id ?? null });
      await applyActive(active);
    })().catch((error: unknown) => {
      console.warn('Could not load campaigns', error);
      set({ loaded: true });
    });
    return loading;
  },

  create: async (name, templateId) => {
    const template =
      [...BUILT_IN_TEMPLATES, ...get().templates].find((t) => t.id === templateId) ??
      BUILT_IN_TEMPLATES[0];
    if (!template) throw new Error('No campaign template');
    const first = get().campaigns.length === 0;
    const campaign = newCampaign(
      name,
      template,
      get().campaigns.map((c) => c.id),
      new Date().toISOString(),
    );
    // The first campaign keeps the source choices made before campaigns existed.
    if (first) {
      campaign.sources = { ...useSourcePrefs.getState().overrides, ...campaign.sources };
    }
    await writeCampaign(campaign);
    if (first) {
      // Bookmarks and notes made before campaigns existed move into the first one.
      const store = await userStore();
      const root = await store.readText(ROOT_ANNOTATIONS_FILE);
      if (root !== null) {
        await store.writeFile(`${campaignDir(campaign.id)}/annotations.json`, root);
        await store.remove(ROOT_ANNOTATIONS_FILE);
      }
    }
    set((s) => ({
      campaigns: [...s.campaigns, campaign].sort((a, b) => a.name.localeCompare(b.name, 'en')),
    }));
    await get().activate(campaign.id);
    return campaign;
  },

  activate: async (id) => {
    const campaign = get().campaigns.find((c) => c.id === id);
    if (!campaign) return;
    set({ activeId: id });
    useActiveCampaignId.setState({ activeId: id });
    await applyActive(campaign);
  },

  update: async (id, patch) => {
    const current = get().campaigns.find((c) => c.id === id);
    if (!current) return;
    const next = { ...current, ...patch };
    set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? next : c)) }));
    await writeCampaign(next);
  },

  remove: async (id) => {
    const store = await userStore();
    await store.remove(campaignDir(id), { recursive: true });
    const campaigns = get().campaigns.filter((c) => c.id !== id);
    set({ campaigns });
    if (get().activeId === id) {
      const next = campaigns[0];
      set({ activeId: next?.id ?? null });
      useActiveCampaignId.setState({ activeId: next?.id ?? null });
      await applyActive(next);
    }
  },

  saveTemplate: async (campaignId, name) => {
    const campaign = get().campaigns.find((c) => c.id === campaignId);
    if (!campaign) return;
    const ids = [...BUILT_IN_TEMPLATES, ...get().templates].map((t) => t.id);
    const template = templateFromCampaign(campaign, name, ids);
    const store = await userStore();
    await store.writeFile(`${TEMPLATES_DIR}/${template.id}.json`, serializeTemplate(template));
    set((s) => ({ templates: [...s.templates, template] }));
  },

  removeTemplate: async (id) => {
    const store = await userStore();
    await store.remove(`${TEMPLATES_DIR}/${id}.json`);
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
  },
}));

/** The campaign open on this device, if any. */
export function useActiveCampaign(): Campaign | undefined {
  return useCampaigns((s) => s.campaigns.find((c) => c.id === s.activeId));
}

// Source toggles changed in the app belong to the active campaign: save them into it.
useSourcePrefs.subscribe((state, previous) => {
  if (applyingSources || state.overrides === previous.overrides) return;
  const { activeId, campaigns } = useCampaigns.getState();
  const active = campaigns.find((c) => c.id === activeId);
  if (!active) return;
  const next = { ...active, sources: { ...state.overrides } };
  useCampaigns.setState({ campaigns: campaigns.map((c) => (c.id === active.id ? next : c)) });
  if (sourcesTimer) clearTimeout(sourcesTimer);
  sourcesTimer = setTimeout(() => {
    sourcesTimer = null;
    void writeCampaign(next).catch((error: unknown) => {
      console.warn('Could not save campaign sources', error);
    });
  }, SAVE_SOURCES_AFTER_MS);
});
