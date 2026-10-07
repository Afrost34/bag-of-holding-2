import type { Edition, EntityDetail, RawEntity } from '@boh/data5e';
import type { BuiltCharacter } from './build';
import { abilityName } from './extract/abilities';
import { parseSpellFilter } from './extract/spells';
import { isAbility, isObj, SKILLS, type Choice, type Pool } from './model';

/**
 * What a choice can be answered with: its fixed options, or the entities its filter matches
 * (spells for a class and level, feats of a category, items of a group…). Pure; the data worker
 * supplies the catalog.
 */

export interface OptionSummary {
  /** What is stored as the pick: an entity key, or a plain value (`stealth`, `dex`, `A`). */
  id: string;
  name: string;
  source?: string;
  edition?: Edition;
  /** A newer printing exists. */
  legacy?: boolean;
  /** One short line: "Level 1 Enchantment", "General feat", "Artisan's tools"… */
  note?: string;
}

export interface OptionCatalog {
  get(key: string): EntityDetail | undefined;
  /** Every entity of a type; the worker caches these. */
  ofType(type: string): EntityDetail[];
  /** The classes whose spell list holds a spell (any case). */
  spellClasses(name: string, source: string): string[];
}

const title = (s: string) =>
  s.replace(/(^|[\s(-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
const code = (v: unknown) => (typeof v === 'string' ? (v.split('|')[0] ?? '') : '');

const SCHOOLS: Record<string, string> = {
  A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment', V: 'Evocation',
  I: 'Illusion', N: 'Necromancy', T: 'Transmutation',
}; // prettier-ignore

const FEAT_CATEGORIES: Record<string, string> = {
  G: 'General feat', O: 'Origin feat', FS: 'Fighting Style feat', 'FS:P': 'Fighting Style feat',
  'FS:R': 'Fighting Style feat', EB: 'Epic Boon', D: 'Dragonmark feat', DG: 'Dark Gift',
}; // prettier-ignore

const featCategory = (e: EntityDetail) =>
  typeof e.data.category === 'string' ? e.data.category : '';

function summary(e: EntityDetail, note?: string): OptionSummary {
  const legacy = Array.isArray(e.data.reprintedAs) && e.data.reprintedAs.length > 0;
  return {
    id: e.key,
    name: e.name,
    source: e.source,
    edition: e.edition,
    ...(legacy ? { legacy } : {}),
    ...(note ? { note } : {}),
  };
}

/** A spell matches `level=1;2|class=Bard|school=E;D|spell attack=m;r|components & miscellaneous=ritual`. */
export function matchesSpellFilter(
  spell: RawEntity,
  filter: string,
  classes: readonly string[],
): boolean {
  const f = parseSpellFilter(filter);
  if (f.level && !f.level.includes(String(spell.level))) return false;
  if (f.class && !f.class.some((c) => classes.some((x) => x.toLowerCase() === c))) return false;
  if (f.school && !f.school.some((s) => s.toUpperCase() === spell.school)) return false;
  if (f.source && !f.source.includes(String(spell.source).toLowerCase())) return false;
  const attack = f['spell attack'];
  if (
    attack &&
    !(
      Array.isArray(spell.spellAttack) &&
      spell.spellAttack.some((a) => attack.includes(String(a).toLowerCase()))
    )
  )
    return false;
  const misc = f['components & miscellaneous'];
  if (misc?.includes('ritual') && !(isObj(spell.meta) && spell.meta.ritual === true)) return false;
  return true;
}

/** 5etools equipment groups (`weaponSimple`, `instrumentMusical`…). */
function matchesEquipmentType(item: RawEntity, group: string): boolean {
  const type = code(item.type);
  const melee = type === 'M';
  switch (group) {
    case 'weaponSimple':
      return item.weaponCategory === 'simple';
    case 'weaponSimpleMelee':
      return item.weaponCategory === 'simple' && melee;
    case 'weaponMartial':
      return item.weaponCategory === 'martial';
    case 'weaponMartialMelee':
      return item.weaponCategory === 'martial' && melee;
    case 'instrumentMusical':
      return type === 'INS';
    case 'toolArtisan':
      return type === 'AT';
    case 'setGaming':
      return type === 'GS';
    case 'focusSpellcastingArcane':
      return type === 'SCF' && item.scfType === 'arcane';
    case 'focusSpellcastingHoly':
      return type === 'SCF' && item.scfType === 'holy';
    case 'focusSpellcastingDruidic':
      return type === 'SCF' && item.scfType === 'druid';
    default:
      return false;
  }
}

const PROPERTY_CODES: Record<string, string> = {
  light: 'L', finesse: 'F', heavy: 'H', 'two-handed': '2H', thrown: 'T', versatile: 'V',
  reach: 'R', loading: 'LD', ammunition: 'A',
}; // prettier-ignore

/** Item filters: `type=martial weapon;simple weapon|property=light;!two-handed|miscellaneous=mundane`. */
export function matchesItemFilter(item: RawEntity, filter: string): boolean {
  const f = parseSpellFilter(filter);
  const props = Array.isArray(item.property) ? item.property.map(code) : [];
  if (f.type) {
    const ok = f.type.some((t) => {
      if (t === 'simple weapon') return item.weaponCategory === 'simple';
      if (t === 'martial weapon') return item.weaponCategory === 'martial';
      if (t === 'melee weapon') return code(item.type) === 'M';
      if (t === 'ranged weapon') return code(item.type) === 'R';
      if (t === 'mundane weapon')
        return item.weapon === true && (item.rarity === 'none' || item.rarity === undefined);
      return false;
    });
    if (!ok) return false;
  }
  if (f.property) {
    const wanted = f.property.filter((p) => !p.startsWith('!')).map((p) => PROPERTY_CODES[p] ?? p);
    const banned = f.property
      .filter((p) => p.startsWith('!'))
      .map((p) => PROPERTY_CODES[p.slice(1)] ?? p);
    if (wanted.length && !wanted.some((p) => props.includes(p))) return false;
    if (banned.some((p) => props.includes(p))) return false;
  }
  if (f.rarity?.includes('none') && item.rarity !== 'none') return false;
  return true;
}

const TOOL_TYPES: Partial<Record<Pool, readonly string[]>> = {
  artisanTool: ['AT'],
  musicalInstrument: ['INS'],
  gamingSet: ['GS'],
  tool: ['T', 'AT', 'INS', 'GS'],
};

/** Plain values (skills, abilities, languages…) shown with a readable name. */
function plain(id: string, catalog: OptionCatalog): OptionSummary {
  if (id.startsWith('pool:'))
    return {
      id,
      name: `Any ${id
        .slice(5)
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()}`,
    };
  if (isAbility(id)) return { id, name: abilityName(id) };
  if (/^[a-z]+:.+@/.test(id)) {
    const e = catalog.get(id) ?? catalog.get(id.replace(/^item:/, 'baseitem:'));
    if (e) return summary(e);
  }
  return { id, name: title(id) };
}

/** Mundane gear: base items plus the ordinary items 5etools keeps with magic ones (holy symbols). */
const mundane = (catalog: OptionCatalog) => [
  ...catalog.ofType('baseitem'),
  ...catalog.ofType('item').filter((i) => i.data.rarity === 'none'),
];

/** Mundane items and tools by key, deduplicated by name (the 2024 printing first). */
function preferNewest(list: EntityDetail[]): EntityDetail[] {
  const byName = new Map<string, EntityDetail>();
  for (const e of list) {
    const k = e.name.toLowerCase();
    const seen = byName.get(k);
    if (!seen || (seen.edition === '2014' && e.edition === '2024')) byName.set(k, e);
  }
  return [...byName.values()];
}

const byName = (a: OptionSummary, b: OptionSummary) =>
  Number(a.legacy ?? false) - Number(b.legacy ?? false) || a.name.localeCompare(b.name, 'en');

/**
 * The options a choice offers. For filters this lists matching entities; a choice with fixed
 * options lists those, named. Options already picked elsewhere stay (the UI marks them).
 */
export function optionsFor(
  choice: Choice,
  built: BuiltCharacter,
  catalog: OptionCatalog,
): OptionSummary[] {
  if (choice.branches) return choice.branches.map((b) => ({ id: b.id, name: b.label }));
  if (choice.options) return choice.options.map((o) => plain(o, catalog));
  const f = choice.filter;
  if (!f) return [];
  switch (f.type) {
    case 'any':
      return [];
    case 'pool': {
      if (f.pool === 'skill') return Object.keys(SKILLS).map((s) => ({ id: s, name: title(s) }));
      if (f.pool === 'proficientSkill') {
        const held = new Set(built.grants.flatMap((g) => (g.kind === 'skill' ? [g.value] : [])));
        const tools = built.grants.flatMap((g) => (g.kind === 'tool' ? [g.value] : []));
        return [...[...held].filter((s) => s in SKILLS).sort(), ...tools].map((s) => ({
          id: s,
          name: title(s),
        }));
      }
      if (f.pool === 'standardLanguage' || f.pool === 'exoticLanguage' || f.pool === 'language') {
        const kind =
          f.pool === 'standardLanguage'
            ? 'standard'
            : f.pool === 'exoticLanguage'
              ? 'exotic'
              : undefined;
        return preferNewest(catalog.ofType('language'))
          .filter(
            (l) => !kind || l.data.type === kind || (kind === 'exotic' && l.data.type === 'rare'),
          )
          .map((l) => ({
            id: l.name.toLowerCase(),
            name: l.name,
            note: title(typeof l.data.type === 'string' ? l.data.type : ''),
          }))
          .sort(byName);
      }
      const types = TOOL_TYPES[f.pool] ?? [];
      return preferNewest(mundane(catalog))
        .filter((i) => types.includes(code(i.data.type)))
        .map((i) => ({ id: i.name.toLowerCase(), name: i.name }))
        .sort(byName);
    }
    case 'spell': {
      return catalog
        .ofType('spell')
        .filter((s) => matchesSpellFilter(s.data, f.filter, catalog.spellClasses(s.name, s.source)))
        .map((s) => {
          const lvl = typeof s.data.level === 'number' ? s.data.level : 0;
          const school = SCHOOLS[String(s.data.school)] ?? '';
          return summary(s, lvl === 0 ? `${school} cantrip` : `Level ${String(lvl)} ${school}`);
        })
        .sort(byName);
    }
    case 'feat':
      return catalog
        .ofType('feat')
        .filter((e) => !f.categories || f.categories.includes(featCategory(e)))
        .map((e) => summary(e, FEAT_CATEGORIES[featCategory(e)] ?? 'Feat'))
        .sort(byName);
    case 'optionalfeature':
      return catalog
        .ofType('optionalfeature')
        .filter(
          (e) =>
            Array.isArray(e.data.featureType) &&
            e.data.featureType.some((t) => f.featureTypes.includes(String(t))),
        )
        .map((e) => summary(e))
        .sort(byName);
    case 'subclass':
      return [];
    case 'items': {
      const groups = f.equipmentType?.split(';');
      return (
        preferNewest(mundane(catalog))
          // Weapon Mastery only offers weapons that have a mastery property.
          .filter((i) => choice.kind !== 'weaponMastery' || Array.isArray(i.data.mastery))
          .filter((i) =>
            groups
              ? groups.some((g) => matchesEquipmentType(i.data, g))
              : f.filter
                ? matchesItemFilter(i.data, f.filter)
                : false,
          )
          .map((i) => summary(i))
          .sort(byName)
      );
    }
  }
}
