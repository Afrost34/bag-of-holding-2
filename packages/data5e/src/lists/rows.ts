import type { Edition } from '../editions';
import {
  alignment,
  crToNumber,
  crValue,
  creatureType,
  DAMAGE_TYPES,
  itemValue,
  itemWeight,
  ITEM_PROPERTIES,
  ITEM_TYPES,
  prerequisite,
  SCHOOLS,
  SIZES,
  spellDuration,
  spellRange,
} from '../format';
import { arr, isObj, num, text, type Obj } from '../json';
import { SPECIFIC_VARIANT_FLAG } from '../itemVariants';
import { buildCard, type CardInfo } from './cards';
import { stripTagsPlain } from './strip';

export type FieldValue = string | number | boolean | string[] | null;

/** One line of a compendium list. Small and structured-clone friendly. */
export interface ListRow {
  key: string;
  type: string;
  name: string;
  source: string;
  edition: Edition;
  page: number | null;
  /** Category fields, keyed by `FieldDef.id`. */
  f: Record<string, FieldValue>;
  /** Second line under the name, e.g. `Evocation • V, S, M` (the source name otherwise). */
  sub?: string;
  /** Superseded by a newer printing (5etools `reprintedAs`): shown with a Legacy badge. */
  legacy?: boolean;
  /** Art card for the `cards` layout (classes, species). */
  card?: CardInfo;
  /** A generated specific magic item variant ("+1 Longsword"): listed only when searching by name. */
  generated?: boolean;
}

/** Spell → class names, from 5etools' generated lookup: `[source][spell name] → classes`. */
export type SpellClassLookup = (name: string, source: string) => string[];

export interface RowContext {
  spellClasses: SpellClassLookup;
  /** Lore and art of an entity, for card layouts. */
  fluff?: (type: string, name: string, source: string) => Obj | undefined;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
const codeOf = (v: unknown) => text(v).split('|')[0] ?? '';

const FEAT_CATEGORIES: Record<string, string> = {
  O: 'Origin', G: 'General', FS: 'Fighting Style', 'FS:P': 'Fighting Style (Paladin)',
  'FS:R': 'Fighting Style (Ranger)', EB: 'Epic Boon', D: 'Dragonmark',
}; // prettier-ignore

const OPTION_TYPES: Record<string, string> = {
  EI: 'Eldritch Invocation', MM: 'Metamagic', 'MV:B': 'Battle Master Maneuver', MV: 'Maneuver',
  'MV:C2-UA': 'Cavalier Maneuver (UA)', 'FS:F': 'Fighting Style (Fighter)', 'FS:B': 'Fighting Style (Bard)',
  'FS:P': 'Fighting Style (Paladin)', 'FS:R': 'Fighting Style (Ranger)', AI: 'Artificer Infusion',
  AS: 'Arcane Shot', 'AS:V1-UA': 'Arcane Shot (UA)', 'AS:V2-UA': 'Arcane Shot (UA)', PB: "Pact Boon",
  ED: 'Elemental Discipline', RN: 'Rune Knight Rune', OR: 'Onomancy Resonant', TT: "Traveler's Trick",
  OTH: 'Other', RP: 'Renown Perk', 'IWM:W': 'Weapon Maneuver', 'IWM:A': 'Armor Model', 'IWM:G': 'Gear',
}; // prettier-ignore

const KIND_LABELS: Record<string, string> = {
  condition: 'Condition', disease: 'Disease', status: 'Status', variantrule: 'Rule', action: 'Action',
  sense: 'Sense', skill: 'Skill', itemProperty: 'Item property', itemMastery: 'Weapon mastery',
  trap: 'Trap', hazard: 'Hazard', object: 'Object', reward: 'Reward', boon: 'Boon', cult: 'Cult',
  vehicle: 'Vehicle', vehicleUpgrade: 'Upgrade', deck: 'Deck', card: 'Card', psionic: 'Psionic',
  recipe: 'Recipe', charoption: 'Character option', legendaryGroup: 'Lair & regional effects',
}; // prettier-ignore

function spellTime(spell: Obj): string {
  const unit = text(arr(spell.time).find(isObj)?.unit);
  if (unit === 'action') return 'Action';
  if (unit === 'bonus') return 'Bonus action';
  if (unit === 'reaction') return 'Reaction';
  if (unit === 'minute') return 'Minute';
  if (unit === 'hour') return 'Hour';
  return 'Other';
}

const SPELL_TIME_UNITS: Record<string, string> = {
  action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction', round: 'Round', minute: 'Minute',
  hour: 'Hour', day: 'Day',
}; // prettier-ignore

/** `1 Action`, `1 Reaction *` (with a trigger), `10 Minutes`. */
function spellTimeText(spell: Obj): string {
  const times = arr(spell.time).filter(isObj);
  const first = times[0];
  if (!first) return '';
  const n = num(first.number) ?? 1;
  const unit = SPELL_TIME_UNITS[text(first.unit)] ?? cap(text(first.unit));
  const base = `${String(n)} ${unit}${n === 1 ? '' : 's'}`;
  return typeof first.condition === 'string' || times.length > 1 ? `${base} *` : base;
}

const plural = (n: number, unit: string) => `${String(n)} ${cap(unit)}${n === 1 ? '' : 's'}`;

/** Compact duration for list cells: `1 Minute`, `Instantaneous` (concentration is a badge). */
function spellDurationText(spell: Obj): string {
  const first = arr(spell.duration).find(isObj);
  if (!first) return '';
  switch (text(first.type)) {
    case 'instant':
      return 'Instantaneous';
    case 'timed': {
      const d = isObj(first.duration) ? first.duration : {};
      return plural(num(d.amount) ?? 1, text(d.type));
    }
    case 'permanent':
      return arr(first.ends).includes('dispel') ? 'Until Dispelled' : 'Permanent';
    default:
      return 'Special';
  }
}

const AREA_SHAPES = new Set([
  'radius',
  'sphere',
  'cone',
  'line',
  'cube',
  'hemisphere',
  'emanation',
  'cylinder',
]);

/** Compact range for list cells: `60 ft.`, `Touch`, `Self (15 ft. cone)`. */
function spellRangeText(spell: Obj): string {
  const range = isObj(spell.range) ? spell.range : {};
  const distance = isObj(range.distance) ? range.distance : {};
  const amount = num(distance.amount);
  const unit = text(distance.type);
  const measure =
    unit === 'feet'
      ? `${String(amount)} ft.`
      : unit === 'miles'
        ? plural(amount ?? 1, 'mile')
        : cap(unit);
  const type = text(range.type);
  if (type === 'point') return measure;
  if (AREA_SHAPES.has(type)) return `Self (${measure} ${type === 'radius' ? 'radius' : type})`;
  return cap(type) || '';
}

const ABILITY_ABBR = (s: string) => s.slice(0, 3).toUpperCase();

/** `CON Save`, `Ranged`, `Melee`. */
function spellAttack(spell: Obj): string {
  const saves = arr(spell.savingThrow).map((s) => `${ABILITY_ABBR(text(s))} Save`);
  const attacks = arr(spell.spellAttack).map((a) => (text(a) === 'M' ? 'Melee' : 'Ranged'));
  return uniq([...attacks, ...saves]).join(' / ');
}

const SPELL_EFFECT_TAGS: Record<string, string> = {
  HL: 'Healing', THP: 'Temp HP', SMN: 'Summoning', TP: 'Teleportation',
}; // prettier-ignore

/** Damage types, else conditions, else a broad effect such as Healing. */
function spellEffect(spell: Obj): string {
  const damage = arr(spell.damageInflict).map((x) => cap(text(x)));
  if (damage.length) return damage.join(', ');
  const conditions = arr(spell.conditionInflict).map((x) => cap(text(x)));
  if (conditions.length) return conditions.join(', ');
  return uniq(arr(spell.miscTags).map((t) => SPELL_EFFECT_TAGS[text(t)] ?? '')).join(', ');
}

/** `sleight of hand` → `Sleight of Hand`. */
const titleCase = (s: string) =>
  s.replace(/\b\w+/g, (w, offset: number) =>
    offset > 0 && /^(of|the|and|or|a|an|in|on)$/.test(w) ? w : cap(w),
  );

/** 2024: the origin feat (`Feat: Magic Initiate (Cleric)`); 2014: the background feature. */
function backgroundFeature(bg: Obj): string | null {
  const feat = arr(bg.feats)
    .filter(isObj)
    .flatMap((f) => Object.keys(f))[0];
  if (feat) {
    const [name = '', variant] = (feat.split('|')[0] ?? '').split(';');
    return `Feat: ${titleCase(name.trim())}${variant ? ` (${titleCase(variant.trim())})` : ''}`;
  }
  const visit = (entries: unknown): string | null => {
    for (const e of arr(entries)) {
      if (!isObj(e)) continue;
      const name = text(e.name);
      if (name.startsWith('Feature:')) return stripTagsPlain(name.slice('Feature:'.length).trim());
      const inner = visit(e.entries);
      if (inner) return inner;
    }
    return null;
  };
  return visit(bg.entries);
}

function itemCategory(item: Obj): string {
  if (item.wondrous === true) return 'Wondrous item';
  if (item.weapon === true || item.weaponCategory !== undefined) {
    return `${cap(text(item.weaponCategory) || 'other')} weapon`;
  }
  if (item.armor === true) return 'Armor';
  const type = ITEM_TYPES[codeOf(item.type)];
  if (type) return cap(type);
  if (item.staff === true) return 'Staff';
  if (item.poison === true) return 'Poison';
  return 'Other';
}

function speedModes(speed: unknown): string[] {
  if (!isObj(speed)) return ['walk'];
  return ['walk', 'burrow', 'climb', 'fly', 'swim'].filter(
    (m) => speed[m] !== undefined && speed[m] !== 0,
  );
}

function fieldsFor(
  type: string,
  d: Obj,
  ctx: RowContext,
  name: string,
  source: string,
): Record<string, FieldValue> {
  switch (type) {
    case 'spell': {
      const meta = isObj(d.meta) ? d.meta : {};
      const comps = isObj(d.components) ? d.components : {};
      const material = comps.m;
      const costly =
        isObj(material) && (material.cost !== undefined || material.consume !== undefined);
      return {
        level: num(d.level) ?? 0,
        school: cap(SCHOOLS[text(d.school)] ?? text(d.school)),
        time: spellTime(d),
        timeText: spellTimeText(d),
        duration: spellDuration(d),
        durationText: spellDurationText(d),
        range: spellRange(d),
        rangeText: spellRangeText(d),
        attack: spellAttack(d) || null,
        effect: spellEffect(d) || null,
        concentration: arr(d.duration).some((x) => isObj(x) && x.concentration === true),
        ritual: meta.ritual === true,
        classes: ctx.spellClasses(name, source),
        damage: arr(d.damageInflict).map((x) => cap(text(x))),
        save: arr(d.savingThrow).map((x) => cap(text(x))),
        conditions: arr(d.conditionInflict).map((x) => cap(text(x))),
        components: uniq([
          comps.v ? 'V' : '',
          comps.s ? 'S' : '',
          material ? (costly ? 'M ($)' : 'M') : '',
        ]),
      };
    }
    case 'monster': {
      const cr = crValue(d.cr);
      const typeText = creatureType(d.type);
      const baseType = isObj(d.type) ? text(d.type.type) || typeText : typeText;
      return {
        cr: cr === undefined || cr === 'Unknown' || cr === '—' ? null : crToNumber(cr),
        crText: cr ?? null,
        type: cap(baseType.split(' ')[0] ?? baseType),
        size: arr(d.size).map((s) => SIZES[text(s)] ?? text(s)),
        alignment: cap(stripTagsPlain(alignment(d.alignment))),
        environment: arr(d.environment).map((e) => cap(text(e))),
        speeds: speedModes(d.speed).map(cap),
        legendary: Array.isArray(d.legendary),
        spellcaster: Array.isArray(d.spellcasting),
      };
    }
    case 'item':
    case 'baseitem':
    case 'magicvariant':
    case 'itemGroup': {
      const inherits = isObj(d.inherits) ? d.inherits : {};
      const rarity = text(d.rarity) || text(inherits.rarity) || 'none';
      return {
        category: type === 'magicvariant' ? 'Generic variant' : itemCategory(d),
        rarity,
        attunement: d.reqAttune !== undefined || inherits.reqAttune !== undefined,
        value: typeof d.value === 'number' ? d.value / 100 : null,
        costText: itemValue(d.value) || null,
        weight: num(d.weight) ?? null,
        weightText: itemWeight(d.weight) || null,
        attuneText:
          d.reqAttune !== undefined || inherits.reqAttune !== undefined ? 'Required' : null,
        magic: rarity !== 'none' && rarity !== '',
        properties: arr(d.property)
          .map((p) => ITEM_PROPERTIES[codeOf(isObj(p) ? p.uid : p)] ?? codeOf(p))
          .map(cap),
        damage: d.dmgType ? [cap(DAMAGE_TYPES[text(d.dmgType)] ?? text(d.dmgType))] : [],
      };
    }
    case 'class': {
      const hd = isObj(d.hd) ? `d${text(d.hd.faces)}` : '';
      const caster = text(d.casterProgression);
      return {
        hitDie: hd || null,
        caster:
          caster === 'full'
            ? 'Full'
            : caster === '1/2'
              ? 'Half'
              : caster === '1/3'
                ? 'Third'
                : caster === 'pact'
                  ? 'Pact magic'
                  : caster === 'artificer'
                    ? 'Half (artificer)'
                    : 'None',
      };
    }
    case 'subclass':
      return { className: text(d.className) };
    case 'race':
    case 'subrace': {
      const speed =
        typeof d.speed === 'number' ? d.speed : isObj(d.speed) ? (num(d.speed.walk) ?? null) : null;
      return {
        size: arr(d.size).map((s) => SIZES[text(s)] ?? text(s)),
        speed,
        darkvision: typeof d.darkvision === 'number' && d.darkvision > 0,
      };
    }
    case 'background':
      return {
        feature: backgroundFeature(d),
        skills: uniq(
          arr(d.skillProficiencies)
            .filter(isObj)
            .flatMap((s) => Object.keys(s).filter((k) => k !== 'choose' && k !== 'any'))
            .map(titleCase),
        ),
      };
    case 'feat':
      return {
        category: FEAT_CATEGORIES[text(d.category)] ?? (text(d.category) || 'General'),
        prerequisite: stripTagsPlain(prerequisite(d.prerequisite)) || null,
        repeatable: d.repeatable === true,
      };
    case 'optionalfeature':
      return {
        featureType: arr(d.featureType).map((t) => OPTION_TYPES[text(t)] ?? text(t)),
        prerequisite: stripTagsPlain(prerequisite(d.prerequisite)) || null,
      };
    case 'deity':
      return {
        pantheon: text(d.pantheon) || null,
        alignment: stripTagsPlain(alignment(d.alignment)) || null,
        domains: arr(d.domains).map((x) => text(x)),
      };
    case 'language':
      return { kind: cap(text(d.type) || 'other') };
    case 'facility':
      return { level: num(d.level) ?? null };
    case 'variantrule':
      return {
        kind:
          text(d.ruleType) === 'O'
            ? 'Optional rule'
            : text(d.ruleType) === 'V'
              ? 'Variant rule'
              : 'Rule',
      };
    default:
      return { kind: KIND_LABELS[type] ?? cap(type) };
  }
}

export function buildRow(
  entity: {
    key: string;
    type: string;
    name: string;
    source: string;
    edition: Edition;
    page: number | null;
    data: Obj;
  },
  ctx: RowContext,
): ListRow {
  const f: Record<string, FieldValue> = {
    edition: entity.edition,
    ...fieldsFor(entity.type, entity.data, ctx, entity.name, entity.source),
  };
  const row: ListRow = {
    key: entity.key,
    type: entity.type,
    name: entity.name,
    source: entity.source,
    edition: entity.edition,
    page: entity.page,
    f,
  };
  const sub = subtitle(entity.type, entity.data, f);
  if (sub) row.sub = sub;
  if (arr(entity.data.reprintedAs).length > 0) row.legacy = true;
  if (entity.data[SPECIFIC_VARIANT_FLAG] === true) row.generated = true;
  if (ctx.fluff && (entity.type === 'class' || entity.type === 'race')) {
    row.card = buildCard(
      entity.type,
      entity.data,
      ctx.fluff(entity.type, entity.name, entity.source),
    );
  }
  return row;
}

function subtitle(type: string, d: Obj, f: Record<string, FieldValue>): string {
  if (type === 'spell') {
    const comps = isObj(d.components) ? d.components : {};
    const parts = [comps.v ? 'V' : '', comps.s ? 'S' : '', comps.m ? 'M' : ''].filter(Boolean);
    return [text(f.school), parts.join(', ')].filter(Boolean).join(' • ');
  }
  if (
    typeof f.category === 'string' &&
    ['item', 'baseitem', 'magicvariant', 'itemGroup'].includes(type)
  ) {
    return f.category;
  }
  return '';
}

/** Builds the spell → classes lookup from the generated aux data (`gendata-spell-source-lookup`). */
export function spellClassLookup(
  getSource: (sourceLower: string) => Record<string, unknown> | undefined,
): SpellClassLookup {
  return (name, source) => {
    const bySpell = getSource(source.toLowerCase());
    const entry = bySpell?.[name.toLowerCase()];
    if (!isObj(entry)) return [];
    const classes: string[] = [];
    for (const group of [entry.class, entry.classVariant]) {
      if (!isObj(group)) continue;
      for (const bySource of Object.values(group)) {
        if (isObj(bySource)) classes.push(...Object.keys(bySource));
      }
    }
    return uniq(classes).sort();
  };
}

/**
 * Marks 2014 rows as Legacy when a 2024 row of the same type and name exists, for content that
 * was reprinted without a `reprintedAs` link (generic magic item variants, for instance).
 */
export function markLegacy(rows: ListRow[]): ListRow[] {
  const modern = new Set(
    rows.filter((r) => r.edition === '2024').map((r) => `${r.type}|${r.name.toLowerCase()}`),
  );
  for (const row of rows) {
    if (row.edition === '2014' && modern.has(`${row.type}|${row.name.toLowerCase()}`)) {
      row.legacy = true;
    }
  }
  return rows;
}
