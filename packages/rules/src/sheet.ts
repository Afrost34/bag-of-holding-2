import type { EntityDetail, RawEntity } from '@boh/data5e';
import type { BuiltCharacter, CharacterDecisions, InventoryItem, RulesData } from './build';
import { isCasterProgression, maxSpellLevel, type CasterProgression } from './extract/classes';
import { ABILITIES, isAbility, isObj, SKILLS, type Ability } from './model';

/**
 * The numbers on a character sheet, each with its breakdown ("Dexterity +3, Proficiency +2,
 * Stone of Good Luck +1"), computed from a built character. Hand-set values (overrides) win and
 * keep the computed value next to them.
 */

export interface Part {
  label: string;
  value: number;
}

export interface SheetValue {
  value: number;
  parts: Part[];
  /** Set when the value was typed in by hand: what the rules give. */
  computed?: number;
}

export interface AbilityLine {
  score: SheetValue;
  modifier: number;
  check: SheetValue;
  save: SheetValue & { proficient: boolean };
}

export interface SkillLine extends SheetValue {
  ability: Ability;
  /** 0 none, 0.5 Jack of All Trades, 1 proficient, 2 expertise. */
  proficiency: 0 | 0.5 | 1 | 2;
}

export interface Attack {
  name: string;
  /** Item or spell key. */
  key: string;
  toHit?: SheetValue;
  /** Save DC and ability for spells that call for a save. */
  save?: { dc: SheetValue; ability: Ability };
  damage?: string;
  range?: string;
  properties: string[];
}

export interface Spellcasting {
  /** Class or subclass key. */
  from: string;
  name: string;
  ability: Ability;
  dc: SheetValue;
  attack: SheetValue;
}

export interface Sheet {
  level: number;
  proficiencyBonus: number;
  abilities: Record<Ability, AbilityLine>;
  skills: Record<string, SkillLine>;
  passive: { perception: SheetValue; investigation: SheetValue; insight: SheetValue };
  initiative: SheetValue;
  ac: SheetValue;
  hp: SheetValue;
  hitDice: { faces: number; count: number }[];
  speed: Record<string, number>;
  senses: Record<string, number>;
  size?: string;
  proficiencies: { armor: string[]; weapons: string[]; tools: string[]; languages: string[] };
  defences: { resist: string[]; immune: string[]; conditionImmune: string[]; vulnerable: string[] };
  spellcasting: Spellcasting[];
  /** Spell slots by spell level (index 1 = 1st level). */
  slots: number[];
  pact?: { slots: number; level: number };
  attacks: Attack[];
  /** Class-table columns at the character's level ("Bardic Die: d6", "Rages: 3"). */
  classTable: { from: string; label: string; value: string }[];
}

const NAMES: Record<Ability, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

export const modifier = (score: number) => Math.floor((score - 10) / 2);
export const proficiencyBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

const sum = (parts: Part[]) => parts.reduce((n, p) => n + p.value, 0);
const value = (parts: Part[]): SheetValue => ({
  value: sum(parts),
  parts: parts.filter((p) => p.value !== 0 || parts.length === 1),
});

/** Multiclass spellcaster table: slots by caster level (PHB). */
const SLOTS: readonly (readonly number[])[] = [
  [],
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]; // prettier-ignore

/** Caster levels a class adds to the multiclass table. 2024 half casters round up. */
function casterLevels(
  p: CasterProgression | undefined,
  level: number,
  edition: '2014' | '2024',
): number {
  switch (p) {
    case 'full':
      return level;
    case '1/2':
      return edition === '2024' ? Math.ceil(level / 2) : Math.floor(level / 2);
    case 'artificer':
      return Math.ceil(level / 2);
    case '1/3':
      return Math.floor(level / 3);
    default:
      return 0;
  }
}

/** `{@filter 3rd|spells|…}` → `3rd`; plain values pass through. */
const cellText = (cell: unknown): string => {
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'string') return cell.replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1');
  if (isObj(cell) && cell.type === 'dice' && Array.isArray(cell.toRoll)) {
    const d: unknown = cell.toRoll[0];
    if (!isObj(d)) return '';
    const n = typeof d.number === 'number' ? d.number : 1;
    return `${n === 1 ? '' : String(n)}d${String(d.faces)}`;
  }
  if (isObj(cell) && 'value' in cell) return cellText(cell.value);
  return '';
};

/** Class-table columns that are about spells (shown elsewhere on the sheet). */
const SPELL_COLUMN = /cantrips|spells|spell slots|slot level|^\d|1st|2nd|3rd/i;

function classTable(entity: RawEntity, level: number): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (!Array.isArray(entity.classTableGroups)) return out;
  for (const group of entity.classTableGroups) {
    if (!isObj(group) || !Array.isArray(group.colLabels) || !Array.isArray(group.rows)) continue;
    const row: unknown = group.rows[level - 1];
    if (!Array.isArray(row)) continue;
    group.colLabels.forEach((raw, i) => {
      const label = cellText(raw);
      if (label && !SPELL_COLUMN.test(label)) out.push({ label, value: cellText(row[i]) });
    });
  }
  return out;
}

function column(entity: RawEntity, label: RegExp, level: number): string | undefined {
  if (!Array.isArray(entity.classTableGroups)) return undefined;
  for (const group of entity.classTableGroups) {
    if (!isObj(group) || !Array.isArray(group.colLabels) || !Array.isArray(group.rows)) continue;
    const i = group.colLabels.findIndex((l) => label.test(cellText(l)));
    const row: unknown = group.rows[level - 1];
    if (i >= 0 && Array.isArray(row)) return cellText(row[i]);
  }
  return undefined;
}

/** Slots from a class's own table (`rowsSpellProgression`), trailing empty levels removed. */
function ownSlots(entity: RawEntity, level: number): number[] | undefined {
  const groups = [
    ...(Array.isArray(entity.classTableGroups) ? (entity.classTableGroups as unknown[]) : []),
    ...(Array.isArray(entity.subclassTableGroups) ? (entity.subclassTableGroups as unknown[]) : []),
  ];
  for (const g of groups) {
    if (!isObj(g) || !Array.isArray(g.rowsSpellProgression)) continue;
    const row: unknown = g.rowsSpellProgression[level - 1];
    if (!Array.isArray(row)) continue;
    const slots = row.map((n) => (typeof n === 'number' ? n : 0));
    while (slots.length && slots.at(-1) === 0) slots.pop();
    return slots;
  }
  return undefined;
}

/** `+1` / `-2` / 1 → 1 / -2 / 1. */
const bonus = (v: unknown): number =>
  typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0;

/** `L|XPHB` → `L`. */
const code = (v: unknown) => (typeof v === 'string' ? (v.split('|')[0] ?? '') : '');

interface HeldItem {
  item: InventoryItem;
  entity: EntityDetail;
  /** Its bonuses count: equipped, and attuned when it needs attunement. */
  active: boolean;
}

function heldItems(data: RulesData, inventory: readonly InventoryItem[]): HeldItem[] {
  return inventory.flatMap((item) => {
    const entity =
      data.get(item.key) ??
      data.get(item.key.replace(/^item:/, 'baseitem:')) ??
      data.get(item.key.replace(/^item:/, 'itemgroup:'));
    if (!entity) return [];
    const needsAttunement = entity.data.reqAttune !== undefined && entity.data.reqAttune !== false;
    return [
      {
        item,
        entity,
        active: item.equipped === true && (!needsAttunement || item.attuned === true),
      },
    ];
  });
}

/** Feature names the sheet reacts to. */
const has = (built: BuiltCharacter, name: string) =>
  built.features.some((f) => f.name.toLowerCase() === name.toLowerCase());

export function computeSheet(
  data: RulesData,
  decisions: CharacterDecisions,
  built: BuiltCharacter,
): Sheet {
  const overrides = decisions.overrides ?? {};
  const final = (path: string, v: SheetValue): SheetValue => {
    const o = overrides[path];
    return o === undefined || o === v.value ? v : { value: o, parts: v.parts, computed: v.value };
  };
  const level = Math.max(1, built.level);
  const pb = proficiencyBonus(level);
  const items = heldItems(data, decisions.inventory ?? []);
  const active = items.filter((i) => i.active);
  const entityName = (key: string) => data.get(key)?.name ?? key;

  // Ability scores: base, increases (capped at 20 unless an increase says otherwise), items.
  const scores = {} as Record<Ability, SheetValue>;
  for (const a of ABILITIES) {
    const parts: Part[] = [{ label: 'Base', value: decisions.baseScores[a] }];
    let cap = 20;
    for (const g of built.grants)
      if (g.kind === 'ability' && g.ability === a) {
        parts.push({ label: entityName(g.from), value: g.amount });
        if (g.max) cap = Math.max(cap, g.max);
      }
    const raw = Math.min(sum(parts), Math.max(cap, decisions.baseScores[a]));
    const capped =
      raw < sum(parts) ? [...parts, { label: 'Maximum', value: raw - sum(parts) }] : parts;
    let v = value(capped);
    for (const { entity } of active) {
      const ab = isObj(entity.data.ability) ? entity.data.ability : undefined;
      const stat = isObj(ab?.static) ? ab.static[a] : undefined;
      if (typeof stat === 'number' && stat > v.value)
        v = { value: stat, parts: [{ label: entity.name, value: stat }] };
      else if (typeof ab?.[a] === 'number')
        v = value([...v.parts, { label: entity.name, value: ab[a] }]);
    }
    scores[a] = final(`score.${a}`, v);
  }
  const mod = (a: Ability) => modifier(scores[a].value);

  const grantValues = (kind: string) =>
    [
      ...new Set(built.grants.flatMap((g) => (g.kind === kind && 'value' in g ? [g.value] : []))),
    ].sort();
  const saves = new Set(grantValues('save'));
  const skillProf = new Set(grantValues('skill'));
  const expertise = new Set(grantValues('expertise'));
  const jack = has(built, 'Jack of All Trades');
  const itemParts = (field: string): Part[] =>
    active.flatMap(({ entity }) =>
      bonus(entity.data[field]) ? [{ label: entity.name, value: bonus(entity.data[field]) }] : [],
    );
  const checkItems = itemParts('bonusAbilityCheck');
  const jackPart = (proficient: boolean): Part[] =>
    jack && !proficient ? [{ label: 'Jack of All Trades', value: Math.floor(pb / 2) }] : [];

  const abilities = {} as Record<Ability, AbilityLine>;
  for (const a of ABILITIES) {
    const m = mod(a);
    const base: Part = { label: NAMES[a], value: m };
    const proficient = saves.has(a);
    const save = value([
      base,
      ...(proficient ? [{ label: 'Proficiency', value: pb }] : []),
      ...itemParts('bonusSavingThrow'),
    ]);
    abilities[a] = {
      score: scores[a],
      modifier: m,
      check: final(`check.${a}`, value([base, ...jackPart(false), ...checkItems])),
      save: { ...final(`save.${a}`, save), proficient },
    };
  }

  const skills: Record<string, SkillLine> = {};
  for (const [skill, a] of Object.entries(SKILLS)) {
    const level2 = expertise.has(skill) && skillProf.has(skill);
    const proficiency: SkillLine['proficiency'] = level2
      ? 2
      : skillProf.has(skill)
        ? 1
        : jack
          ? 0.5
          : 0;
    const parts: Part[] = [{ label: NAMES[a], value: mod(a) }];
    if (proficiency >= 1)
      parts.push({ label: level2 ? 'Expertise' : 'Proficiency', value: pb * proficiency });
    parts.push(...jackPart(proficiency >= 1), ...checkItems);
    skills[skill] = { ...final(`skill.${skill}`, value(parts)), ability: a, proficiency };
  }
  const passive = (skill: string): SheetValue => {
    const s = skills[skill];
    return final(`passive.${skill}`, value([{ label: 'Base', value: 10 }, ...(s?.parts ?? [])]));
  };

  const initiative = final(
    'initiative',
    value([
      { label: 'Dexterity', value: mod('dex') },
      ...jackPart(false),
      ...checkItems,
      ...(has(built, 'Alert')
        ? [{ label: 'Alert', value: built.entities.get('feat:alert@xphb') ? pb : 5 }]
        : []),
    ]),
  );

  // Armour Class: worn armour, or the best unarmoured formula; then shield and items.
  const armour = active.find(({ entity }) => ['LA', 'MA', 'HA'].includes(code(entity.data.type)));
  const shield = active.find(({ entity }) => code(entity.data.type) === 'S');
  const dex = mod('dex');
  let acParts: Part[];
  if (armour) {
    const kind = code(armour.entity.data.type);
    const dexPart = kind === 'HA' ? 0 : kind === 'MA' ? Math.min(2, dex) : dex;
    acParts = [
      { label: armour.entity.name, value: Number(armour.entity.data.ac) || 10 },
      { label: 'Dexterity', value: dexPart },
    ];
  } else {
    const options: Part[][] = [
      [
        { label: 'Unarmoured', value: 10 },
        { label: 'Dexterity', value: dex },
      ],
    ];
    if (has(built, 'Unarmored Defense')) {
      const second: Ability = built.classes.some((c) => c.key.startsWith('class:monk'))
        ? 'wis'
        : 'con';
      options.push([
        { label: 'Unarmored Defense', value: 10 },
        { label: 'Dexterity', value: dex },
        { label: NAMES[second], value: mod(second) },
      ]);
    }
    if (has(built, 'Draconic Resilience'))
      options.push([
        { label: 'Draconic Resilience', value: 13 },
        { label: 'Dexterity', value: dex },
      ]);
    acParts = options.reduce((best, o) => (sum(o) > sum(best) ? o : best));
  }
  if (shield)
    acParts.push({ label: shield.entity.name, value: Number(shield.entity.data.ac) || 2 });
  acParts.push(...itemParts('bonusAc'));
  const ac = final('ac', value(acParts));

  // Hit points: maximum die at level 1, then rolls or the average, plus Constitution each level.
  const hitDice: Sheet['hitDice'] = [];
  const hpParts: Part[] = [];
  const rolls = [...(decisions.hitPointRolls ?? [])];
  built.classes.forEach((c, i) => {
    const cls = built.entities.get(c.key);
    const faces =
      isObj(cls?.data.hd) && typeof cls.data.hd.faces === 'number' ? cls.data.hd.faces : 8;
    hitDice.push({ faces, count: c.levels });
    for (let l = 1; l <= c.levels; l++) {
      if (i === 0 && l === 1) hpParts.push({ label: `${c.name} 1 (maximum)`, value: faces });
      else {
        const roll = rolls.shift();
        hpParts.push({
          label: `${c.name} ${String(l)}${roll === undefined ? ' (average)' : ' (rolled)'}`,
          value: roll ?? faces / 2 + 1,
        });
      }
    }
  });
  hpParts.push({ label: 'Constitution', value: mod('con') * level });
  if (has(built, 'Tough')) hpParts.push({ label: 'Tough', value: 2 * level });
  if (has(built, 'Dwarven Toughness')) hpParts.push({ label: 'Dwarven Toughness', value: level });
  const hp = final('hp', value(hpParts));

  // Speed and senses come from the species (a subspecies replaces what it sets).
  const speed: Record<string, number> = {};
  const senses: Record<string, number> = {};
  const species = [...built.entities.values()].filter(
    (e) => e.type === 'race' || e.type === 'subrace',
  );
  for (const e of species) {
    const s = e.data.speed;
    if (typeof s === 'number') speed.walk = s;
    else if (isObj(s))
      for (const [k, v] of Object.entries(s)) if (typeof v === 'number') speed[k] = v;
    if (typeof e.data.darkvision === 'number') senses.darkvision = e.data.darkvision;
    if (typeof e.data.blindsight === 'number') senses.blindsight = e.data.blindsight;
  }
  if (!('walk' in speed)) speed.walk = 30;
  for (const { entity } of active) {
    const ms = isObj(entity.data.modifySpeed) ? entity.data.modifySpeed : undefined;
    if (isObj(ms?.static))
      for (const [k, v] of Object.entries(ms.static))
        if (typeof v === 'number') speed[k] = Math.max(speed[k] ?? 0, v);
  }
  if (overrides['speed.walk'] !== undefined) speed.walk = overrides['speed.walk'];

  // Spellcasting: per class (or subclass, for Eldritch Knights), and the slot tables.
  const spellcasting: Spellcasting[] = [];
  let casterLevel = 0;
  let casterClasses = 0;
  let single: number[] | undefined;
  let pact: Sheet['pact'];
  for (const c of built.classes) {
    const cls = built.entities.get(c.key);
    const sub = c.subclass ? built.entities.get(c.subclass) : undefined;
    for (const e of [cls, sub]) {
      if (!e) continue;
      const ability = e.data.spellcastingAbility;
      const progression = isCasterProgression(e.data.casterProgression)
        ? e.data.casterProgression
        : undefined;
      if (!isAbility(ability) || maxSpellLevel(progression, c.levels, e.edition) === 0) continue;
      const m = mod(ability);
      spellcasting.push({
        from: e.key,
        name: e.name,
        ability,
        dc: final(
          `spell.dc.${e.key}`,
          value([
            { label: 'Base', value: 8 },
            { label: NAMES[ability], value: m },
            { label: 'Proficiency', value: pb },
            ...itemParts('bonusSpellSaveDc'),
          ]),
        ),
        attack: final(
          `spell.attack.${e.key}`,
          value([
            { label: NAMES[ability], value: m },
            { label: 'Proficiency', value: pb },
            ...itemParts('bonusSpellAttack'),
          ]),
        ),
      });
      if (progression === 'pact') {
        const slots = Number(column(e.data, /^spell slots$/i, c.levels)) || 0;
        const slotLevel = parseInt(column(e.data, /^slot level$/i, c.levels) ?? '', 10) || 0;
        pact = { slots, level: slotLevel };
      } else {
        casterLevel += casterLevels(progression, c.levels, e.edition);
        casterClasses++;
        // A single-class caster uses its own table (2014 half casters round up there).
        single = ownSlots(e.data, c.levels) ?? [
          ...(SLOTS[casterLevels(progression, c.levels, e.edition)] ?? []),
        ];
      }
    }
  }
  const table =
    casterClasses === 1 && single ? single : [...(SLOTS[Math.min(20, casterLevel)] ?? [])];
  const slots = [0, ...table];

  // Attacks: carried weapons, and cantrips that attack or force a save.
  const weaponProf = new Set(grantValues('weapon'));
  const attacks: Attack[] = [];
  for (const { entity, item } of items) {
    const d = entity.data;
    if (d.weapon !== true && !d.dmg1) continue;
    const props = Array.isArray(d.property) ? d.property.map(code) : [];
    const ranged = code(d.type) === 'R';
    const ability: Ability = props.includes('F')
      ? mod('dex') >= mod('str')
        ? 'dex'
        : 'str'
      : ranged
        ? 'dex'
        : 'str';
    const baseKey =
      isObj(d) && typeof d.baseItem === 'string'
        ? `item:${d.baseItem.replace('|', '@')}`.toLowerCase()
        : entity.key;
    const proficient =
      (typeof d.weaponCategory === 'string' && weaponProf.has(d.weaponCategory)) ||
      // "Firearms" (homebrew classes, 2014 DMG option): every weapon 5etools flags as one.
      (d.firearm === true && weaponProf.has('firearms')) ||
      [...weaponProf].some(
        (w) => w === entity.key || w === baseKey || w.replace(/^item:/, 'baseitem:') === entity.key,
      );
    const magic = bonus(d.bonusWeapon) + bonus(d.bonusWeaponAttack);
    const toHit = value([
      { label: NAMES[ability], value: mod(ability) },
      ...(proficient ? [{ label: 'Proficiency', value: pb }] : []),
      ...(magic ? [{ label: entity.name, value: magic }] : []),
    ]);
    const dmgBonus = mod(ability) + bonus(d.bonusWeapon) + bonus(d.bonusWeaponDamage);
    attacks.push({
      name: entity.name,
      key: item.key,
      toHit: final(`attack.${item.key}`, toHit),
      ...(typeof d.dmg1 === 'string'
        ? {
            damage:
              `${d.dmg1}${dmgBonus ? (dmgBonus > 0 ? `+${String(dmgBonus)}` : String(dmgBonus)) : ''} ${DAMAGE[String(d.dmgType)] ?? ''}`.trim(),
          }
        : {}),
      ...(typeof d.range === 'string' ? { range: d.range } : {}),
      properties: props,
    });
  }
  const caster = spellcasting[0];
  for (const g of built.grants) {
    if (g.kind !== 'spell' || !caster) continue;
    const spell = data.get(g.key);
    if (spell?.data.level !== 0) continue;
    const attack = Array.isArray(spell.data.spellAttack) && spell.data.spellAttack.length > 0;
    const save: unknown = Array.isArray(spell.data.savingThrow)
      ? spell.data.savingThrow[0]
      : undefined;
    const saveAbility = typeof save === 'string' ? (save.slice(0, 3) as Ability) : undefined;
    if (!attack && !saveAbility) continue;
    attacks.push({
      name: spell.name,
      key: spell.key,
      ...(attack ? { toHit: caster.attack } : {}),
      ...(saveAbility && isAbility(saveAbility)
        ? { save: { dc: caster.dc, ability: saveAbility } }
        : {}),
      properties: [],
    });
  }

  const size = grantValues('size').at(-1);

  return {
    level,
    proficiencyBonus: pb,
    abilities,
    skills,
    passive: {
      perception: passive('perception'),
      investigation: passive('investigation'),
      insight: passive('insight'),
    },
    initiative,
    ac,
    hp,
    hitDice,
    speed,
    senses,
    ...(size ? { size } : {}),
    proficiencies: {
      armor: grantValues('armor'),
      weapons: [...weaponProf].sort(),
      tools: grantValues('tool'),
      languages: grantValues('language'),
    },
    defences: {
      resist: grantValues('resist'),
      immune: grantValues('immune'),
      conditionImmune: grantValues('conditionImmune'),
      vulnerable: grantValues('vulnerable'),
    },
    spellcasting,
    slots,
    ...(pact ? { pact } : {}),
    attacks,
    classTable: built.classes.flatMap((c) => {
      const cls = built.entities.get(c.key);
      return cls ? classTable(cls.data, c.levels).map((col) => ({ from: c.key, ...col })) : [];
    }),
  };
}

const DAMAGE: Record<string, string> = {
  A: 'acid', B: 'bludgeoning', C: 'cold', F: 'fire', O: 'force', L: 'lightning', N: 'necrotic',
  P: 'piercing', I: 'poison', Y: 'psychic', R: 'radiant', S: 'slashing', T: 'thunder',
}; // prettier-ignore
