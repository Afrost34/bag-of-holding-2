/**
 * Campaigns as stored in the user's data (the local clone of the data repo from M4 on):
 *
 *   campaigns/<id>/campaign.json      name, edition, source toggles, rule settings
 *   campaigns/<id>/annotations.json   bookmarks and notes on compendium pages
 *   templates/<id>.json               the user's own campaign templates
 *
 * Source toggles use the same shape as the app-wide ones: overrides of the default (everything
 * on except playtest material), keyed by lowercased source id.
 */

export type CampaignEdition = '2014' | '2024' | 'mixed';

export type Advancement = 'milestone' | 'xp';
export type Encumbrance = 'off' | 'standard' | 'variant';

export interface CampaignRules {
  /** Levels come when the DM says (milestones) or from experience points. */
  advancement: Advancement;
  /** Carrying capacity: off, the standard rule, or variant encumbrance. */
  encumbrance: Encumbrance;
  /** 2014 optional class features (Tasha's) offered by the character builder. */
  optionalClassFeatures: boolean;
}

export interface Campaign {
  version: 1;
  id: string;
  name: string;
  /** Preferred edition: links without a source, the builder and encounter math follow it. */
  edition: CampaignEdition;
  sources: Record<string, boolean>;
  rules: CampaignRules;
  createdAt: string;
}

/** What a new campaign is made from: a template, or the settings chosen when creating it. */
export type CampaignSettings = Pick<Campaign, 'edition' | 'sources' | 'rules'>;

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  edition: CampaignEdition;
  sources: Record<string, boolean>;
  rules: CampaignRules;
  builtIn: boolean;
}

export const DEFAULT_RULES: CampaignRules = {
  advancement: 'milestone',
  encumbrance: 'off',
  optionalClassFeatures: true,
};

export const EDITION_LABELS: Record<CampaignEdition, string> = {
  '2024': '2024 rules',
  '2014': '2014 rules',
  mixed: 'Mixed editions',
};

export const BUILT_IN_TEMPLATES: readonly CampaignTemplate[] = [
  {
    id: 'builtin-2024',
    name: '2024 rules',
    description: '2024 core books first; 2014 content stays available, marked Legacy.',
    edition: '2024',
    sources: {},
    rules: DEFAULT_RULES,
    builtIn: true,
  },
  {
    id: 'builtin-2014',
    name: '2014 rules',
    description: 'The 2014 books; the 2024 core books are turned off.',
    edition: '2014',
    sources: { xphb: false, xdmg: false, xmm: false },
    rules: DEFAULT_RULES,
    builtIn: true,
  },
  {
    id: 'builtin-mixed',
    name: 'Mixed editions',
    description: 'Everything on; choose per character and encounter, with warnings where they mix.',
    edition: 'mixed',
    sources: {},
    rules: DEFAULT_RULES,
    builtIn: true,
  },
];

export const CAMPAIGNS_DIR = 'campaigns';
export const TEMPLATES_DIR = 'templates';

export function campaignDir(id: string): string {
  return `${CAMPAIGNS_DIR}/${id}`;
}

export function campaignFile(id: string): string {
  return `${campaignDir(id)}/campaign.json`;
}

/** `Rust & Sunfire` → `rust-sunfire`, unique among `existing`. */
export function slugify(name: string, existing: readonly string[]): string {
  const base =
    name
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'campaign';
  let id = base;
  for (let n = 2; existing.includes(id); n++) id = `${base}-${String(n)}`;
  return id;
}

export function newCampaign(
  name: string,
  template: CampaignSettings,
  existingIds: readonly string[],
  now: string,
): Campaign {
  return {
    version: 1,
    id: slugify(name, existingIds),
    name: name.trim() || 'Untitled campaign',
    edition: template.edition,
    sources: { ...template.sources },
    rules: { ...template.rules },
    createdAt: now,
  };
}

export function templateFromCampaign(
  campaign: Campaign,
  name: string,
  existingIds: readonly string[],
): CampaignTemplate {
  return {
    id: slugify(name, existingIds),
    name: name.trim() || campaign.name,
    description: `Made from ${campaign.name}.`,
    edition: campaign.edition,
    sources: { ...campaign.sources },
    rules: { ...campaign.rules },
    builtIn: false,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function parseEdition(v: unknown): CampaignEdition {
  return v === '2014' || v === '2024' || v === 'mixed' ? v : '2024';
}

function parseSources(v: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [k, on] of Object.entries(isObj(v) ? v : {})) {
    if (typeof on === 'boolean') out[k.toLowerCase()] = on;
  }
  return out;
}

function parseRules(v: unknown): CampaignRules {
  const r = isObj(v) ? v : {};
  return {
    advancement: r.advancement === 'xp' ? 'xp' : 'milestone',
    encumbrance:
      r.encumbrance === 'standard' || r.encumbrance === 'variant' ? r.encumbrance : 'off',
    optionalClassFeatures:
      typeof r.optionalClassFeatures === 'boolean'
        ? r.optionalClassFeatures
        : DEFAULT_RULES.optionalClassFeatures,
  };
}

function parseJson(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const raw: unknown = JSON.parse(text);
    return isObj(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** A campaign file; the folder name is its id. Null when unreadable. */
export function parseCampaign(text: string | null, id: string): Campaign | null {
  const raw = parseJson(text);
  if (!raw) return null;
  return {
    version: 1,
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : id,
    edition: parseEdition(raw.edition),
    sources: parseSources(raw.sources),
    rules: parseRules(raw.rules),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
  };
}

export function parseTemplate(text: string | null, id: string): CampaignTemplate | null {
  const raw = parseJson(text);
  if (!raw) return null;
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : id,
    description: typeof raw.description === 'string' ? raw.description : '',
    edition: parseEdition(raw.edition),
    sources: parseSources(raw.sources),
    rules: parseRules(raw.rules),
    builtIn: false,
  };
}

/** Files are written without the id (the folder or file name is the id). */
export function serializeCampaign(c: Campaign): string {
  const { id: _id, ...rest } = c;
  return `${JSON.stringify(rest, null, 2)}\n`;
}

export function serializeTemplate(t: CampaignTemplate): string {
  const { id: _id, builtIn: _builtIn, ...rest } = t;
  return `${JSON.stringify(rest, null, 2)}\n`;
}
