import { setProperty, type PropertyValue } from './properties';
import { applyTemplate } from './templates';

/**
 * Built-in kinds of campaign notes (NPC, location, faction…): the properties each starts with,
 * its sections, and the base listing them. Notes of a kind carry `type: <id>`, which is what the
 * bases filter on, so a new NPC appears in the NPCs base at once. Locations, factions and
 * deities embed bases that list what links to them (the NPCs at a location, a faction's members).
 *
 * Creatures, items and spells are not here: they are custom compendium entries.
 */

export type FieldKind = 'text' | 'number' | 'checkbox' | 'date' | 'link' | 'links' | 'list';

export interface FieldDef {
  key: string;
  kind: FieldKind;
  /** Suggested values (free text is still allowed). */
  options?: readonly string[];
  /** For links: the kind of note suggested. */
  linkType?: string;
  /** The value a new note starts with. */
  initial?: PropertyValue;
}

export interface NoteType {
  id: string;
  label: string;
  plural: string;
  /** Lucide icon name, for the menu. */
  icon: string;
  /** Folder for new notes, unless the journal already has one matching `folderMatch`. */
  folder: string;
  folderMatch: RegExp;
  fields: readonly FieldDef[];
  /** How the wizard groups the fields, one step each (a Picture step follows). */
  steps: readonly { label: string; keys: readonly string[] }[];
  /** The note's body; `{{title}}` and `{{date}}` are filled in. */
  body: string;
  /** Columns of its base's main view. */
  columns: readonly string[];
  groupBy?: string;
  sortBy?: string;
}

export const ALIGNMENTS = [
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
  'Unaligned',
] as const;

const LEVELS = ['Low', 'Moderate', 'High', 'Extreme'] as const;
const INFLUENCE = ['Minimal', 'Low', 'Moderate', 'High', 'Dominant'] as const;

/** An embedded base listing notes of `type` whose `property` points at this note. */
function linkedHere(title: string, type: string, property: string, columns: string[]): string {
  return [
    '```base',
    'views:',
    '  - type: table',
    `    name: ${title}`,
    '    filters:',
    '      and:',
    `        - type == "${type}"`,
    `        - ${property}.contains(this)`,
    '    order:',
    ...['file.name', ...columns].map((c) => `      - ${c}`),
    '```',
  ].join('\n');
}

export const NOTE_TYPES: readonly NoteType[] = [
  {
    id: 'npc',
    label: 'NPC',
    plural: 'NPCs',
    icon: 'user',
    folder: 'NPCs',
    folderMatch: /\bnpcs?\b/i,
    steps: [
      { label: 'Basics', keys: ['race', 'class', 'level', 'alignment', 'status'] },
      { label: 'Place in the world', keys: ['role', 'location', 'faction'] },
      { label: 'Story', keys: ['motivation', 'secret', 'danger_level'] },
    ],
    fields: [
      { key: 'race', kind: 'text' },
      { key: 'class', kind: 'text' },
      { key: 'level', kind: 'number' },
      { key: 'role', kind: 'text' },
      { key: 'location', kind: 'link', linkType: 'location' },
      { key: 'faction', kind: 'link', linkType: 'faction' },
      { key: 'alignment', kind: 'text', options: ALIGNMENTS },
      { key: 'danger_level', kind: 'text', options: LEVELS },
      {
        key: 'status',
        kind: 'text',
        options: ['Alive', 'Dead', 'Missing', 'Unknown'],
        initial: 'Alive',
      },
      { key: 'motivation', kind: 'text' },
      { key: 'secret', kind: 'text' },
    ],
    body: [
      '## Appearance',
      '',
      '## Personality',
      '',
      '## Motivations',
      '',
      '## Secrets',
      '',
      '## Relationships',
      '',
      '## Notes',
      '',
      linkedHere('Quests', 'quest', 'giver', ['status', 'location']),
      '',
    ].join('\n'),
    columns: ['role', 'location', 'faction', 'danger_level', 'status'],
    groupBy: 'location',
  },
  {
    id: 'location',
    label: 'Location',
    plural: 'Locations',
    icon: 'map-pin',
    folder: 'Locations',
    folderMatch: /\blocations?\b|\bplaces?\b/i,
    steps: [
      { label: 'Basics', keys: ['location_type', 'region', 'population'] },
      { label: 'Connections', keys: ['parent_location', 'faction'] },
      { label: 'Dangers', keys: ['dangers'] },
    ],
    fields: [
      {
        key: 'location_type',
        kind: 'text',
        options: [
          'City',
          'Town',
          'Village',
          'District',
          'Building',
          'Shop',
          'Tavern',
          'Temple',
          'Dungeon',
          'Wilderness',
          'Region',
        ],
      },
      { key: 'region', kind: 'text' },
      { key: 'parent_location', kind: 'link', linkType: 'location' },
      { key: 'faction', kind: 'link', linkType: 'faction' },
      { key: 'population', kind: 'text' },
      { key: 'dangers', kind: 'text' },
    ],
    body: [
      '## Description',
      '',
      '## Notable features',
      '',
      '## Hooks',
      '',
      '## Who is here',
      '',
      linkedHere('NPCs here', 'npc', 'location', ['role', 'faction']),
      '',
      '## Places inside',
      '',
      linkedHere('Places inside', 'location', 'parent_location', ['location_type']),
      '',
    ].join('\n'),
    columns: ['location_type', 'region', 'parent_location', 'population'],
    groupBy: 'region',
  },
  {
    id: 'faction',
    label: 'Faction',
    plural: 'Factions',
    icon: 'flag',
    folder: 'Factions',
    folderMatch: /\bfactions?\b|\borgani[sz]ations?\b/i,
    steps: [
      { label: 'Basics', keys: ['faction_type', 'alignment', 'influence'] },
      { label: 'People and places', keys: ['leader', 'base_location'] },
      { label: 'Goals and rivals', keys: ['goals', 'allies', 'enemies'] },
    ],
    fields: [
      {
        key: 'faction_type',
        kind: 'text',
        options: [
          'Guild',
          'Government',
          'Criminal',
          'Religious',
          'Military',
          'Secret society',
          'Mercenary',
          'Noble house',
        ],
      },
      { key: 'alignment', kind: 'text', options: ALIGNMENTS },
      { key: 'influence', kind: 'text', options: INFLUENCE },
      { key: 'leader', kind: 'link', linkType: 'npc' },
      { key: 'base_location', kind: 'link', linkType: 'location' },
      { key: 'goals', kind: 'text' },
      { key: 'allies', kind: 'links', linkType: 'faction', initial: [] },
      { key: 'enemies', kind: 'links', linkType: 'faction', initial: [] },
    ],
    body: [
      '## Overview',
      '',
      '## Goals',
      '',
      '## Resources',
      '',
      '## Members',
      '',
      linkedHere('Members', 'npc', 'faction', ['role', 'location']),
      '',
      '## Holdings',
      '',
      linkedHere('Holdings', 'location', 'faction', ['location_type', 'region']),
      '',
    ].join('\n'),
    columns: ['faction_type', 'influence', 'leader', 'alignment'],
    groupBy: 'faction_type',
  },
  {
    id: 'session',
    label: 'Session',
    plural: 'Sessions',
    icon: 'calendar',
    folder: 'Sessions',
    folderMatch: /\bsessions?\b/i,
    steps: [
      { label: 'Basics', keys: ['session_number', 'act', 'status', 'date_played'] },
      { label: 'Cast', keys: ['key_locations', 'key_npcs'] },
    ],
    fields: [
      { key: 'session_number', kind: 'number' },
      { key: 'act', kind: 'text' },
      { key: 'status', kind: 'text', options: ['Planned', 'Prep', 'Played'], initial: 'Planned' },
      { key: 'date_played', kind: 'date' },
      { key: 'key_locations', kind: 'links', linkType: 'location', initial: [] },
      { key: 'key_npcs', kind: 'links', linkType: 'npc', initial: [] },
    ],
    body: [
      '## Recap',
      '',
      '## Strong start',
      '',
      '## Scenes',
      '- [ ] ',
      '',
      '## Secrets and clues',
      '- [ ] ',
      '',
      '## Treasure',
      '',
      '## Notes',
      '',
    ].join('\n'),
    columns: ['session_number', 'act', 'status', 'date_played'],
    sortBy: 'session_number',
  },
  {
    id: 'quest',
    label: 'Quest',
    plural: 'Quests',
    icon: 'scroll',
    folder: 'Quests',
    folderMatch: /\bquests?\b/i,
    steps: [
      { label: 'Basics', keys: ['status', 'reward'] },
      { label: 'People and places', keys: ['giver', 'location'] },
    ],
    fields: [
      {
        key: 'status',
        kind: 'text',
        options: ['Available', 'Active', 'Completed', 'Failed'],
        initial: 'Available',
      },
      { key: 'giver', kind: 'link', linkType: 'npc' },
      { key: 'location', kind: 'link', linkType: 'location' },
      { key: 'reward', kind: 'text' },
    ],
    body: ['## Hook', '', '## Objectives', '- [ ] ', '', '## Rewards', '', '## Notes', ''].join(
      '\n',
    ),
    columns: ['status', 'giver', 'location', 'reward'],
    groupBy: 'status',
  },
  {
    id: 'religion',
    label: 'Religion',
    plural: 'Religions',
    icon: 'church',
    folder: 'Religions',
    folderMatch: /\breligions?\b|\bfaiths?\b/i,
    steps: [
      { label: 'Basics', keys: ['religion_type', 'alignment', 'influence'] },
      { label: 'People', keys: ['associated_deity', 'leader'] },
      { label: 'Beliefs', keys: ['core_beliefs'] },
    ],
    fields: [
      { key: 'religion_type', kind: 'text', options: ['Church', 'Order', 'Sect', 'Cult'] },
      { key: 'associated_deity', kind: 'link', linkType: 'deity' },
      { key: 'leader', kind: 'link', linkType: 'npc' },
      { key: 'alignment', kind: 'text', options: ALIGNMENTS },
      { key: 'influence', kind: 'text', options: INFLUENCE },
      { key: 'core_beliefs', kind: 'text' },
    ],
    body: ['## Beliefs', '', '## Practices', '', '## Hierarchy', '', '## Notes', ''].join('\n'),
    columns: ['religion_type', 'associated_deity', 'influence', 'leader'],
    groupBy: 'religion_type',
  },
  {
    id: 'deity',
    label: 'Deity',
    plural: 'Deities',
    icon: 'sun',
    folder: 'Deities',
    folderMatch: /\bdeit(y|ies)\b|\bgods?\b|\bpantheon\b/i,
    steps: [{ label: 'Basics', keys: ['domains', 'alignment', 'symbol'] }],
    fields: [
      { key: 'domains', kind: 'list', initial: [] },
      { key: 'alignment', kind: 'text', options: ALIGNMENTS },
      { key: 'symbol', kind: 'text' },
    ],
    body: [
      '## Description',
      '',
      '## Worship',
      '',
      linkedHere('Religions', 'religion', 'associated_deity', ['religion_type', 'influence']),
      '',
    ].join('\n'),
    columns: ['domains', 'alignment', 'symbol'],
  },
];

/** Fields written as a few sentences rather than a word or two. */
const LONG_FIELDS = new Set(['motivation', 'secret', 'goals', 'core_beliefs', 'dangers', 'reward']);

export function isLongField(key: string): boolean {
  return LONG_FIELDS.has(key);
}

/** A property's name for people: `danger_level` → Danger level. */
export function fieldLabel(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A kind of note made by the DM (Ships, Guilds…): what is stored for it, without the parts the
 * app fills in (folder matching, wizard steps, body).
 */
export interface CustomNoteTypeDef {
  id: string;
  label: string;
  plural: string;
  /** Icon name (see the app's NoteTypeIcon). */
  icon: string;
  fields: FieldDef[];
  /** Columns of its lists; the first fields when absent. */
  columns?: string[];
}

const FIELD_KINDS = new Set<FieldKind>([
  'text',
  'number',
  'checkbox',
  'date',
  'link',
  'links',
  'list',
]);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A custom kind as a full note type: its own folder, one wizard step, a description section. */
export function customNoteType(def: CustomNoteTypeDef): NoteType {
  return {
    id: def.id,
    label: def.label,
    plural: def.plural,
    icon: def.icon,
    folder: def.plural,
    folderMatch: new RegExp(`\\b${escapeRe(def.plural.toLowerCase())}\\b`, 'i'),
    fields: def.fields,
    steps: def.fields.length ? [{ label: 'Details', keys: def.fields.map((f) => f.key) }] : [],
    body: '## Description\n\n',
    columns: def.columns ?? def.fields.slice(0, 4).map((f) => f.key),
  };
}

/** Custom kinds read from a campaign's file, skipping anything malformed. */
export function parseNoteTypeDefs(json: unknown): CustomNoteTypeDef[] {
  if (!Array.isArray(json)) return [];
  const builtIn = new Set(NOTE_TYPES.map((t) => t.id));
  return json.flatMap((d): CustomNoteTypeDef[] => {
    if (typeof d !== 'object' || d === null) return [];
    const r = d as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.label !== 'string' || builtIn.has(r.id)) return [];
    const fields = (Array.isArray(r.fields) ? r.fields : []).flatMap((f): FieldDef[] => {
      if (typeof f !== 'object' || f === null) return [];
      const ff = f as Record<string, unknown>;
      if (typeof ff.key !== 'string' || !FIELD_KINDS.has(ff.kind as FieldKind)) return [];
      return [
        {
          key: ff.key,
          kind: ff.kind as FieldKind,
          ...(Array.isArray(ff.options)
            ? { options: ff.options.filter((o): o is string => typeof o === 'string') }
            : {}),
          ...(typeof ff.linkType === 'string' ? { linkType: ff.linkType } : {}),
        },
      ];
    });
    return [
      {
        id: r.id,
        label: r.label,
        plural: typeof r.plural === 'string' && r.plural ? r.plural : `${r.label}s`,
        icon: typeof r.icon === 'string' ? r.icon : 'file',
        fields,
        ...(Array.isArray(r.columns)
          ? { columns: r.columns.filter((c): c is string => typeof c === 'string') }
          : {}),
      },
    ];
  });
}

/** An id for a new kind ("Sea Ship" → `sea-ship`), unique among `taken`. */
export function noteTypeId(label: string, taken: readonly string[]): string {
  const base =
    label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'kind';
  const used = new Set([...taken, ...NOTE_TYPES.map((t) => t.id)]);
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${String(n)}`;
  return id;
}

let custom: NoteType[] = [];

/** The open campaign's own kinds (the app sets them when it reads the campaign). */
export function setCustomNoteTypes(defs: readonly CustomNoteTypeDef[]): void {
  custom = defs.map(customNoteType);
}

/** Every kind: the built-in ones, then the campaign's own. */
export function allNoteTypes(): readonly NoteType[] {
  return [...NOTE_TYPES, ...custom];
}

export function noteType(id: unknown): NoteType | undefined {
  return typeof id === 'string' ? allNoteTypes().find((t) => t.id === id.toLowerCase()) : undefined;
}

/** A new note of a kind: its properties (empty but present, so they can be filled in) and body. */
export function newNoteText(type: NoteType, title: string, now = new Date()): string {
  let text = `\n${applyTemplate(type.body, { title, now })}`;
  text = setProperty(text, 'type', type.id);
  text = setProperty(text, 'tags', [type.id]);
  for (const f of type.fields) text = setProperty(text, f.key, f.initial ?? null);
  return text;
}

/** The base listing every note of a kind (written once, when the first one is made). */
export function baseFor(type: NoteType): string {
  const lines = [
    'views:',
    '  - type: table',
    `    name: All ${type.plural}`,
    '    filters:',
    '      and:',
    `        - type == "${type.id}"`,
    '    order:',
    ...['file.name', ...type.columns].map((c) => `      - ${c}`),
  ];
  if (type.sortBy) {
    lines.push('    sort:', `      - property: ${type.sortBy}`, '        direction: ASC');
  }
  if (type.groupBy) {
    lines.push('    groupBy:', `      property: ${type.groupBy}`, '      direction: ASC');
  }
  lines.push(
    '  - type: cards',
    '    name: Cards',
    '    filters:',
    '      and:',
    `        - type == "${type.id}"`,
    '    order:',
    ...['file.name', ...type.columns.slice(0, 3)].map((c) => `      - ${c}`),
  );
  return `${lines.join('\n')}\n`;
}

/** Whether a base already lists notes of this kind (so another one is not made). */
export function baseListsType(baseText: string, type: NoteType): boolean {
  return new RegExp(`type\\s*==?\\s*["']${type.id}["']`, 'i').test(baseText);
}
