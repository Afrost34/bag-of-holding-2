/**
 * Readable text for 5etools data fields. Pure functions; strings may contain `{@tags}`, which
 * the caller renders with RichText.
 */

import { arr, isObj, num, text, type Obj } from './json';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];
export const ABILITY_NAME: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom',
  cha: 'Charisma',
}; // prettier-ignore

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function signed(n: number): string {
  return n >= 0 ? `+${String(n)}` : `−${String(Math.abs(n))}`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${String(n)}${s[(v - 20) % 10] ?? s[v] ?? s[0] ?? 'th'}`;
}

// region Spells

export const SCHOOLS: Record<string, string> = {
  A: 'abjuration', C: 'conjuration', D: 'divination', E: 'enchantment', V: 'evocation',
  I: 'illusion', N: 'necromancy', T: 'transmutation', P: 'psionic',
}; // prettier-ignore

/** `3rd-level evocation`, `Evocation cantrip`; 2024 style `Level 3 Evocation`. */
export function spellLevelSchool(spell: Obj, edition: '2014' | '2024' = '2014'): string {
  const level = num(spell.level) ?? 0;
  const school = SCHOOLS[String(spell.school)] ?? text(spell.school);
  const ritual = isObj(spell.meta) && spell.meta.ritual === true;
  if (edition === '2024') {
    const base = level === 0 ? `${cap(school)} Cantrip` : `Level ${String(level)} ${cap(school)}`;
    return ritual ? `${base} (Ritual)` : base;
  }
  const base = level === 0 ? `${cap(school)} cantrip` : `${ordinal(level)}-level ${school}`;
  return ritual ? `${base} (ritual)` : base;
}

const TIME_UNITS: Record<string, [string, string]> = {
  action: ['action', 'actions'], bonus: ['bonus action', 'bonus actions'],
  reaction: ['reaction', 'reactions'], round: ['round', 'rounds'], minute: ['minute', 'minutes'],
  hour: ['hour', 'hours'], day: ['day', 'days'], week: ['week', 'weeks'], year: ['year', 'years'],
}; // prettier-ignore

export function castingTime(spell: Obj): string {
  return arr(spell.time)
    .filter(isObj)
    .map((t) => {
      const n = num(t.number) ?? 1;
      const unit = TIME_UNITS[String(t.unit)] ?? [String(t.unit), String(t.unit)];
      const base = `${String(n)} ${n === 1 ? unit[0] : unit[1]}`;
      return typeof t.condition === 'string' ? `${base}, ${t.condition}` : base;
    })
    .join(' or ');
}

export function spellRange(spell: Obj): string {
  const range = isObj(spell.range) ? spell.range : {};
  const dist = isObj(range.distance) ? range.distance : {};
  const amount = num(dist.amount);
  const dtype = text(dist.type);
  const distText =
    dtype === 'self' ? 'Self' : dtype === 'touch' ? 'Touch' : dtype === 'sight' ? 'Sight'
      : dtype === 'unlimited' ? 'Unlimited' : amount !== undefined
        ? `${String(amount)} ${amount === 1 ? dtype.replace(/s$/, '').replace('feet', 'foot') : dtype}`
        : cap(dtype); // prettier-ignore
  switch (range.type) {
    case 'special':
      return 'Special';
    case 'point':
      return distText;
    case 'line':
    case 'cone':
    case 'cube':
    case 'cylinder':
    case 'emanation':
    case 'radius':
    case 'sphere':
    case 'hemisphere':
      return amount !== undefined
        ? `Self (${String(amount)}-${dtype === 'miles' ? 'mile' : 'foot'} ${range.type})`
        : `Self (${range.type})`;
    default:
      return distText;
  }
}

export function components(spell: Obj): string {
  const c = isObj(spell.components) ? spell.components : {};
  const parts: string[] = [];
  if (c.v) parts.push('V');
  if (c.s) parts.push('S');
  if (c.m) {
    const m = isObj(c.m) ? text(c.m.text) : typeof c.m === 'string' ? c.m : '';
    parts.push(m ? `M (${m})` : 'M');
  }
  if (c.r) parts.push('R');
  return parts.join(', ');
}

const DURATION_UNITS: Record<string, [string, string]> = {
  round: ['round', 'rounds'], minute: ['minute', 'minutes'], hour: ['hour', 'hours'],
  day: ['day', 'days'], week: ['week', 'weeks'], year: ['year', 'years'], turn: ['turn', 'turns'],
}; // prettier-ignore

export function spellDuration(spell: Obj): string {
  return arr(spell.duration)
    .filter(isObj)
    .map((d) => {
      switch (d.type) {
        case 'instant':
          return 'Instantaneous';
        case 'special':
          return 'Special';
        case 'permanent': {
          const ends = arr(d.ends).map(String);
          if (ends.length === 0) return 'Permanent';
          const words = ends.map((e) =>
            e === 'dispel' ? 'dispelled' : e === 'trigger' ? 'triggered' : e,
          );
          return `Until ${words.join(' or ')}`;
        }
        case 'timed': {
          const dur = isObj(d.duration) ? d.duration : {};
          const n = num(dur.amount) ?? 1;
          const unit = DURATION_UNITS[String(dur.type)] ?? [String(dur.type), String(dur.type)];
          const time = `${String(n)} ${n === 1 ? unit[0] : unit[1]}`;
          if (d.concentration === true) return `Concentration, up to ${time}`;
          return dur.upTo === true ? `Up to ${time}` : time;
        }
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join(' or ');
}

// endregion

// region Creatures

export const SIZES: Record<string, string> = {
  T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan', V: 'Varies',
}; // prettier-ignore

export function sizeText(size: unknown): string {
  const sizes = arr(size).map((s) => SIZES[String(s)] ?? String(s));
  return sizes.length > 1
    ? `${sizes.slice(0, -1).join(', ')} or ${sizes.at(-1) ?? ''}`
    : (sizes[0] ?? '');
}

export function creatureType(type: unknown): string {
  if (typeof type === 'string') return type;
  if (!isObj(type)) return '';
  const base = isObj(type.type) ? arr(type.type.choose).map(String).join(' or ') : text(type.type);
  const tags = arr(type.tags)
    .map((t) => (isObj(t) ? `${text(t.prefix)} ${text(t.tag)}`.trim() : String(t)))
    .filter(Boolean);
  const swarm =
    typeof type.swarmSize === 'string'
      ? `swarm of ${(SIZES[type.swarmSize] ?? type.swarmSize).toLowerCase()} `
      : '';
  const plural = swarm ? `${base}s` : base;
  return `${swarm}${plural}${tags.length ? ` (${tags.join(', ')})` : ''}`;
}

const ALIGN: Record<string, string> = {
  L: 'lawful', N: 'neutral', NX: 'neutral', NY: 'neutral', C: 'chaotic', G: 'good', E: 'evil',
  U: 'unaligned', A: 'any alignment',
}; // prettier-ignore

export function alignment(value: unknown): string {
  const list = arr(value);
  if (list.length === 0) return '';
  if (list.every((a) => typeof a === 'string')) {
    const codes = list;
    if (codes.length === 1) return ALIGN[codes[0] ?? ''] ?? codes[0] ?? '';
    if (
      codes.length === 2 &&
      codes.includes('N') &&
      !codes.includes('NX') &&
      !codes.includes('NY')
    ) {
      return codes.map((c) => ALIGN[c] ?? c).join(' ');
    }
    if (codes.length >= 5) {
      // e.g. any non-good
      const missing = ['G', 'E', 'L', 'C'].filter((c) => !codes.includes(c));
      return missing.length === 1
        ? `any non-${ALIGN[missing[0] ?? ''] ?? ''} alignment`
        : 'any alignment';
    }
    return codes.map((c) => ALIGN[c] ?? c).join(' ');
  }
  return list
    .filter(isObj)
    .map((a) => {
      if (typeof a.special === 'string') return a.special;
      const text = alignment(a.alignment);
      return typeof a.chance === 'number' ? `${text} (${String(a.chance)}%)` : text;
    })
    .join(' or ');
}

export function armorClass(ac: unknown): string {
  return arr(ac)
    .map((a) => {
      if (typeof a === 'number') return String(a);
      if (!isObj(a)) return '';
      if (typeof a.special === 'string') return a.special;
      const from = arr(a.from).map(String);
      const cond = typeof a.condition === 'string' ? ` ${a.condition}` : '';
      return `${text(a.ac)}${from.length ? ` (${from.join(', ')})` : ''}${cond}`;
    })
    .filter(Boolean)
    .join(', ');
}

export function speed(value: unknown): string {
  if (typeof value === 'number') return `${String(value)} ft.`;
  if (!isObj(value)) return '';
  const order = ['walk', 'burrow', 'climb', 'fly', 'swim'];
  const parts: string[] = [];
  for (const mode of order) {
    const v = value[mode];
    if (v === undefined) continue;
    const n = typeof v === 'number' ? v : isObj(v) ? num(v.number) : undefined;
    const condition = isObj(v) && typeof v.condition === 'string' ? ` ${v.condition}` : '';
    if (n === undefined && v !== true) continue;
    const amount = v === true ? 'equal to walking speed' : `${String(n)} ft.`;
    const hover = mode === 'fly' && value.canHover === true && !condition ? ' (hover)' : '';
    parts.push(mode === 'walk' ? `${amount}${condition}` : `${mode} ${amount}${condition}${hover}`);
  }
  if (isObj(value.choose)) {
    const modes = arr(value.choose.from).map(String).join(' or ');
    parts.push(`${modes} ${text(value.choose.amount)} ft.`);
  }
  return parts.join(', ');
}

export const DAMAGE_TYPES: Record<string, string> = {
  A: 'acid', B: 'bludgeoning', C: 'cold', F: 'fire', O: 'force', L: 'lightning', N: 'necrotic',
  P: 'piercing', I: 'poison', Y: 'psychic', R: 'radiant', S: 'slashing', T: 'thunder',
}; // prettier-ignore

/** `resist`, `immune`, `vulnerable` and `conditionImmune` lists, with nested notes. */
export function damageList(value: unknown, key: string): string {
  const parts = arr(value).map((v): string => {
    if (typeof v === 'string') return v;
    if (!isObj(v)) return '';
    if (typeof v.special === 'string') return v.special;
    const inner = damageList(v[key], key);
    const pre = typeof v.preNote === 'string' ? `${v.preNote} ` : '';
    const note = typeof v.note === 'string' ? ` ${v.note}` : '';
    return `${pre}${inner}${note}`;
  });
  // Plain entries are comma-separated; entries with notes are separated by semicolons.
  const plain = parts.filter((_p, i) => typeof arr(value)[i] === 'string');
  const complex = parts.filter((_p, i) => typeof arr(value)[i] !== 'string');
  return [plain.join(', '), ...complex].filter(Boolean).join('; ');
}

const XP_BY_CR: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000,
  '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000,
  '28': 120000, '29': 135000, '30': 155000,
}; // prettier-ignore

export function crValue(cr: unknown): string | undefined {
  if (typeof cr === 'string') return cr;
  if (isObj(cr) && typeof cr.cr === 'string') return cr.cr;
  return undefined;
}

export function crToNumber(cr: string): number {
  const fraction = /^(\d+)\/(\d+)$/.exec(cr);
  return fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(cr);
}

export function proficiencyForCr(cr: string): number {
  const n = crToNumber(cr);
  return Number.isFinite(n) && n >= 5 ? Math.ceil(n / 4) + 1 : 2;
}

/** `1/4 (XP 50; PB +2)`, with lair XP when present. */
export function challenge(cr: unknown): string {
  const value = crValue(cr);
  if (value === undefined || value === 'Unknown' || value === '—') return value ?? '';
  const xp = isObj(cr) && typeof cr.xp === 'number' ? cr.xp : XP_BY_CR[value];
  const lair = isObj(cr) && typeof cr.lair === 'string' ? XP_BY_CR[cr.lair] : undefined;
  const xpText =
    xp === undefined
      ? ''
      : `XP ${xp.toLocaleString('en-US')}${lair ? `, or ${lair.toLocaleString('en-US')} in lair` : ''}`;
  return `${value} (${[xpText, `PB ${signed(proficiencyForCr(value))}`].filter(Boolean).join('; ')})`;
}

// endregion

// region Items

export const ITEM_TYPES: Record<string, string> = {
  A: 'ammunition', AF: 'ammunition', AT: "artisan's tools", AIR: 'vehicle (air)',
  EXP: 'explosive', FD: 'food and drink', G: 'adventuring gear', GS: 'gaming set',
  GV: 'generic variant', HA: 'heavy armor', INS: 'instrument', LA: 'light armor',
  M: 'melee weapon', MA: 'medium armor', MNT: 'mount', OTH: 'other', P: 'potion', R: 'ranged weapon',
  RD: 'rod', RG: 'ring', S: 'shield', SC: 'scroll', SCF: 'spellcasting focus', SHP: 'vehicle (water)',
  SPC: 'vehicle (space)', T: 'tools', TAH: 'tack and harness', TB: 'trade bar', TG: 'trade good',
  VEH: 'vehicle (land)', WD: 'wand', $A: 'art object', $C: 'coins', $G: 'gemstone',
  ST: 'staff', W: 'wondrous item',
}; // prettier-ignore

export const ITEM_PROPERTIES: Record<string, string> = {
  '2H': 'two-handed', A: 'ammunition', AF: 'ammunition', BF: 'burst fire', F: 'finesse',
  H: 'heavy', L: 'light', LD: 'loading', R: 'reach', RLD: 'reload', S: 'special', T: 'thrown',
  V: 'versatile', ER: 'extended reach', OTH: 'other',
}; // prettier-ignore

const code = (v: unknown) => text(v).split('|')[0] ?? '';

export function itemTypeLine(item: Obj): string {
  const parts: string[] = [];
  const type = ITEM_TYPES[code(item.type)];
  if (item.wondrous === true) parts.push('wondrous item');
  else if (type) parts.push(type);
  if (item.staff === true && !parts.includes('staff')) parts.push('staff');
  if (typeof item.tier === 'string') parts.push(item.tier);
  const rarity = typeof item.rarity === 'string' && item.rarity !== 'none' ? item.rarity : '';
  let line = cap(parts.join(', '));
  if (rarity) line = line ? `${line}, ${rarity}` : cap(rarity);
  if (item.reqAttune === true) line += ' (requires attunement)';
  else if (typeof item.reqAttune === 'string') line += ` (requires attunement ${item.reqAttune})`;
  return line;
}

/** Copper pieces → `15 gp`, `2 sp`, `5 cp`, `1,500 gp`. */
export function itemValue(cp: unknown): string {
  if (typeof cp !== 'number') return '';
  if (cp >= 100 && cp % 100 === 0) return `${(cp / 100).toLocaleString('en-US')} gp`;
  if (cp >= 10 && cp % 10 === 0) return `${(cp / 10).toLocaleString('en-US')} sp`;
  return `${cp.toLocaleString('en-US')} cp`;
}

export function itemWeight(weight: unknown): string {
  return typeof weight === 'number' ? `${String(weight)} lb.` : '';
}

export function itemProperties(item: Obj): string {
  return arr(item.property)
    .map((p) => {
      const abbr = isObj(p) ? code(p.uid ?? p.abbreviation) : code(p);
      const name = ITEM_PROPERTIES[abbr] ?? abbr.toLowerCase();
      if (abbr === 'V' && typeof item.dmg2 === 'string') return `${name} (${item.dmg2})`;
      if ((abbr === 'T' || abbr === 'A') && typeof item.range === 'string')
        return `${name} (${item.range} ft.)`;
      return name;
    })
    .filter(Boolean)
    .join(', ');
}

// endregion

// region Prerequisites

/** A readable prerequisite line for feats, optional features and the like. */
export function prerequisite(value: unknown): string {
  return arr(value)
    .filter(isObj)
    .map((p) => {
      const parts: string[] = [];
      if (isObj(p.level)) parts.push(`${ordinal(num(p.level.level) ?? 1)} level`);
      else if (typeof p.level === 'number') parts.push(`${ordinal(p.level)} level`);
      for (const a of arr(p.ability).filter(isObj)) {
        parts.push(
          Object.entries(a)
            .map(
              ([k, v]) =>
                `${(ABILITY_NAME as Record<string, string | undefined>)[k] ?? k} ${text(v)}+`,
            )
            .join(' or '),
        );
      }
      for (const r of arr(p.race).filter(isObj)) parts.push(cap(text(r.displayEntry ?? r.name)));
      for (const f of arr(p.feat)) parts.push(`{@feat ${String(f)}}`);
      if (p.spellcasting === true || p.spellcasting2020 === true)
        parts.push('The ability to cast at least one spell');
      if (p.spellcastingFeature === true) parts.push('Spellcasting or Pact Magic feature');
      for (const s of arr(p.spell))
        parts.push(
          String(s).includes('{@') ? String(s) : `{@spell ${String(s).replace('#c', '')}} cantrip`,
        );
      for (const prof of arr(p.proficiency).filter(isObj)) {
        if (typeof prof.armor === 'string') parts.push(`Proficiency with ${prof.armor} armor`);
        if (typeof prof.weapon === 'string') parts.push(`Proficiency with ${prof.weapon} weapons`);
        if (typeof prof.weaponGroup === 'string')
          parts.push(`Proficiency with ${prof.weaponGroup} weapons`);
      }
      if (typeof p.other === 'string') parts.push(p.other);
      if (
        typeof p.otherSummary === 'object' &&
        isObj(p.otherSummary) &&
        typeof p.otherSummary.entry === 'string'
      ) {
        parts.push(p.otherSummary.entry);
      }
      if (isObj(p.background)) parts.push(text(p.background.name));
      for (const b of arr(p.background).filter(isObj)) parts.push(`${text(b.name)} background`);
      if (typeof p.campaign === 'object')
        parts.push(`${arr(p.campaign).map(String).join(' or ')} campaign`);
      if (p.psionics === true) parts.push('Psionic Talent feature or Wild Talent feat');
      return parts.filter(Boolean).join(', ');
    })
    .filter(Boolean)
    .join('; or ');
}

// endregion

// region Feats

function abilityOr(codes: string[]): string {
  const names = codes.map(
    (c) => (ABILITY_NAME as Partial<Record<string, string>>)[c] ?? c.toUpperCase(),
  );
  if (names.length <= 2) return names.join(' or ');
  return `${names.slice(0, -1).join(', ')}, or ${names.at(-1) ?? ''}`;
}

/**
 * A feat's ability score increase, which 5etools stores as data (`ability`), as the sentence the
 * book prints: "Increase your Strength score by 1, to a maximum of 20." Empty when there is none
 * or it is only a hint for tools (`hidden`).
 */
export function featAbility(ability: unknown): string {
  return arr(ability)
    .filter(isObj)
    .filter((option) => option.hidden !== true)
    .map((option) => {
      const max = num(option.max) ?? 20;
      if (isObj(option.choose)) {
        const from = arr(option.choose.from).map((c) => text(c));
        const amount = num(option.choose.amount) ?? 1;
        const which =
          from.length === 6 ? 'one ability score of your choice' : `your ${abilityOr(from)} score`;
        return `Increase ${which} by ${String(amount)}, to a maximum of ${String(max)}.`;
      }
      return Object.entries(option)
        .filter(([k, v]) => k in ABILITY_NAME && typeof v === 'number')
        .map(
          ([k, v]) =>
            `Increase your ${ABILITY_NAME[k as Ability]} score by ${String(v)}, to a maximum of ${String(max)}.`,
        )
        .join(' ');
    })
    .filter(Boolean)
    .join(' ');
}

// endregion
