import type { Edition } from '../editions';
import {
  alignment,
  crToNumber,
  crValue,
  creatureType,
  DAMAGE_TYPES,
  ITEM_PROPERTIES,
  ITEM_TYPES,
  prerequisite,
  SCHOOLS,
  SIZES,
  spellRange,
} from '../format';
import { arr, isObj, num, text, type Obj } from '../json';
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
}

/** Spell → class names, from 5etools' generated lookup: `[source][spell name] → classes`. */
export type SpellClassLookup = (name: string, source: string) => string[];

export interface RowContext {
  spellClasses: SpellClassLookup;
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
        range: spellRange(d),
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
        alignment: stripTagsPlain(alignment(d.alignment)),
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
        weight: num(d.weight) ?? null,
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
        skills: uniq(
          arr(d.skillProficiencies)
            .filter(isObj)
            .flatMap((s) => Object.keys(s).filter((k) => k !== 'choose' && k !== 'any'))
            .map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())),
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
  return {
    key: entity.key,
    type: entity.type,
    name: entity.name,
    source: entity.source,
    edition: entity.edition,
    page: entity.page,
    f: {
      edition: entity.edition,
      ...fieldsFor(entity.type, entity.data, ctx, entity.name, entity.source),
    },
  };
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
