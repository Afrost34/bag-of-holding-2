/**
 * `_copy` resolution: 5etools defines many entities as a copy of another plus modifications.
 * This is a port of `DataUtil.generic.copyApplier` (5etools js/utils.js, v2.36.1) so resolved
 * entities match what the 5etools site shows. Keep it in sync when bumping the pinned version.
 */
import { identify, type RawEntity } from './identity';

type Json = unknown;
type ModInfo = string | (RawEntity & { mode?: string });

export class CopyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CopyError';
  }
}

/** Fields only inherited when `_copy._preserve` asks for them. */
const PRESERVE_BASE = new Set([
  'page',
  'otherSources',
  'referenceSources',
  'srd',
  'srd52',
  'basicRules',
  'basicRules2024',
  'reprintedAs',
  'hasFluff',
  'hasFluffImages',
  'hasToken',
  'tokenCredit',
  'tokenCustom',
  'foundryTokenScale',
  'altArt',
  '_versions',
]);

const PRESERVE_BY_TYPE: Record<string, readonly string[]> = {
  monster: [
    'legendaryGroup',
    'environment',
    'soundClip',
    'altArt',
    'variant',
    'dragonCastingColor',
    'familiar',
  ],
  item: ['lootTables', 'tier'],
  itemGroup: ['lootTables', 'tier'],
  magicvariant: ['lootTables', 'tier'],
};

/** Statblock props that the `*` mod key applies to. */
const COPY_ENTRY_PROPS = [
  'action',
  'bonus',
  'reaction',
  'trait',
  'legendary',
  'mythic',
  'variant',
  'spellcasting',
  'actionHeader',
  'bonusHeader',
  'reactionHeader',
  'legendaryHeader',
  'mythicHeader',
];

/** Types whose `_copy._templates` refer to template entities of another type. */
const TEMPLATE_TYPES: Record<string, string> = {
  monster: 'monsterTemplate',
  legendaryGroup: 'legendaryGroupTemplate',
};

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const SIZES = ['T', 'S', 'M', 'L', 'H', 'G', 'V'];
const SKILL_ABILITY: Record<string, string> = {
  athletics: 'str',
  acrobatics: 'dex',
  'sleight of hand': 'dex',
  stealth: 'dex',
  arcana: 'int',
  history: 'int',
  investigation: 'int',
  nature: 'int',
  religion: 'int',
  'animal handling': 'wis',
  insight: 'wis',
  medicine: 'wis',
  perception: 'wis',
  survival: 'wis',
  deception: 'cha',
  intimidation: 'cha',
  performance: 'cha',
  persuasion: 'cha',
};

// region Small helpers

const isObj = (v: Json): v is RawEntity => typeof v === 'object' && v !== null && !Array.isArray(v);
const clone = <T>(v: T): T => structuredClone(v);

function getPath(obj: RawEntity, path: readonly string[]): Json {
  let cur: Json = obj;
  for (const p of path) {
    if (!isObj(cur) && !Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, Json>)[p];
  }
  return cur;
}

function setPath(obj: RawEntity, path: readonly string[], value: Json): void {
  let cur: Record<string, Json> = obj;
  path.slice(0, -1).forEach((p) => {
    if (!isObj(cur[p]) && !Array.isArray(cur[p])) cur[p] = {};
    cur = cur[p] as Record<string, Json>;
  });
  const last = path.at(-1);
  if (last !== undefined) cur[last] = value;
}

function deletePath(obj: RawEntity, path: readonly string[]): void {
  const parent = getPath(obj, path.slice(0, -1));
  const last = path.at(-1);
  if (last !== undefined && (isObj(parent) || Array.isArray(parent))) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (parent as Record<string, Json>)[last];
  }
}

/** Applies `fn` to every string inside a JSON value, returning a new value. */
function walkStrings(value: Json, fn: (s: string) => string): Json {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((v) => walkStrings(v, fn));
  if (isObj(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walkStrings(v, fn)]));
  }
  return value;
}

/** Splits text into plain runs and `{@tag ...}` runs (tags may nest). */
export function splitByTags(str: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str.charAt(i);
    if (ch === '{' && str[i + 1] === '@') {
      if (depth === 0 && buf) {
        out.push(buf);
        buf = '';
      }
      depth++;
    }
    buf += ch;
    if (ch === '}' && depth > 0) {
      depth--;
      if (depth === 0) {
        out.push(buf);
        buf = '';
      }
    }
  }
  if (buf) out.push(buf);
  return out;
}

function deepEquals(a: Json, b: Json): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A JSON value as text: strings as-is, numbers formatted, anything else empty. */
const text = (v: Json): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';

const arrayOrNull = (v: Json): Json[] | null => (Array.isArray(v) ? (v as Json[]) : null);

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function crToNumber(cr: Json): number | null {
  const raw = isObj(cr) ? cr.cr : cr;
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return null;
  if (raw === 'Unknown' || raw === '—') return null;
  const fraction = /^(\d+)\/(\d+)$/.exec(raw);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function crToProficiency(cr: Json): number {
  const n = crToNumber(cr);
  if (n === null) return 0;
  if (n < 5) return 2;
  return Math.ceil(n / 4) + 1;
}

const XP_BY_CR: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000,
  '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000,
  '28': 120000, '29': 135000, '30': 155000,
}; // prettier-ignore

const signed = (n: number) => (n >= 0 ? `+${String(n)}` : String(n));
const cleanMath = (s: string) => s.replace(/[^-+/*0-9.,]+/g, '');

/** Evaluates a tiny arithmetic expression (digits and + - * / only) without `eval`. */
function evalMath(expr: string): number {
  const tokens =
    cleanMath(expr)
      .replaceAll(',', '')
      .match(/\d+(?:\.\d+)?|[-+*/]/g) ?? [];
  let pos = 0;
  const term = (): number => {
    let value = factor();
    while (tokens[pos] === '*' || tokens[pos] === '/') {
      const op = tokens[pos++];
      const rhs = factor();
      value = op === '*' ? value * rhs : value / rhs;
    }
    return value;
  };
  const factor = (): number => {
    const tok = tokens[pos++];
    if (tok === '-') return -factor();
    if (tok === '+') return factor();
    return Number(tok ?? 0);
  };
  let value = term();
  while (tokens[pos] === '+' || tokens[pos] === '-') {
    const op = tokens[pos++];
    const rhs = term();
    value = op === '+' ? value + rhs : value - rhs;
  }
  return value;
}

// endregion

// region Variables: <$mode__detail$> placeholders inside mods

function shortName(ent: RawEntity, titleCase: boolean): string {
  const name = typeof ent.name === 'string' ? ent.name : '';
  const named = ent.isNamedCreature === true;
  const prefix = named ? '' : titleCase ? 'The ' : 'the ';
  if (ent.shortName === true) return `${prefix}${name}`;
  if (typeof ent.shortName === 'string') {
    const s = ent.shortName;
    return `${prefix}${!prefix && titleCase ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : s.toLowerCase()}`;
  }
  const base = (name.split(',')[0] ?? '').replace(
    /(?:adult|ancient|young) \w+ (dragon|dracolich)/gi,
    '$1',
  );
  return `${prefix}${named ? (base.split(' ')[0] ?? '') : base.toLowerCase()}`;
}

const SIZE_MULT: Record<string, number> = { L: 2, H: 3, G: 4 };

function resolveVariable(ent: RawEntity, mode: string, detail: string | undefined): string | null {
  const score = (abil: string) => Number(ent[abil]);
  const pb = crToProficiency(ent.cr);
  const sizeMult = SIZE_MULT[(ent.size as string[] | undefined)?.[0] ?? 'M'] ?? 1;
  switch (mode) {
    case 'name':
      return typeof ent.name === 'string' ? ent.name : '';
    case 'short_name':
      return shortName(ent, false);
    case 'title_short_name':
      return shortName(ent, true);
    case 'dc':
    case 'spell_dc':
      return String(8 + abilityMod(score(detail ?? '')) + pb);
    case 'to_hit':
      return signed(pb + abilityMod(score(detail ?? '')));
    case 'damage_mod': {
      const total = abilityMod(score(detail ?? ''));
      return total === 0 ? '' : total > 0 ? ` + ${String(total)}` : ` - ${String(Math.abs(total))}`;
    }
    case 'damage_avg': {
      const replaced = (detail ?? '')
        .replace(/\b(str|dex|con|int|wis|cha)\b/gi, (_m, abil: string) =>
          String(abilityMod(score(abil.toLowerCase()))),
        )
        .replace(/\bsize_mult\b/g, String(sizeMult));
      return String(Math.floor(evalMath(replaced)));
    }
    case 'size_mult':
      return detail ? String(Math.floor(sizeMult * evalMath(detail))) : String(sizeMult);
    default:
      return null;
  }
}

function resolveVariables(value: Json, ent: RawEntity): Json {
  return walkStrings(value, (str) =>
    str.replace(/<\$([^$]+)\$>/g, (match, variable: string) => {
      const [mode = '', detail] = variable.split('__');
      return resolveVariable(ent, mode, detail) ?? match;
    }),
  );
}

// endregion

// region Mod operations

interface ModContext {
  copyTo: RawEntity;
  info: RawEntity;
  path: string[] | null;
  fail: string;
}

const asArray = (v: Json): Json[] => (Array.isArray(v) ? v : [v]);
const nameOf = (v: Json): string | undefined =>
  isObj(v) && typeof v.name === 'string' ? v.name : undefined;

function replaceTxt({ copyTo, info, path }: ModContext, onlyNames = false): void {
  if (!path) return;
  const ents = arrayOrNull(getPath(copyTo, path));
  if (!ents) return;
  const re = new RegExp(
    String(info.replace),
    `g${typeof info.flags === 'string' ? info.flags : ''}`,
  );
  const withStr = text(info.with);
  const handle = (s: string) =>
    info.tagInsensitive === true
      ? s.replace(re, withStr)
      : splitByTags(s)
          .map((part) => (part.startsWith('{@') ? part : part.replace(re, withStr)))
          .join('');

  if (onlyNames) {
    for (const ent of ents)
      if (isObj(ent) && typeof ent.name === 'string') ent.name = handle(ent.name);
    return;
  }
  const props = Array.isArray(info.props)
    ? (info.props as (string | null)[])
    : [null, 'entries', 'headerEntries', 'footerEntries'];
  if (props.length === 0) return;
  if (props.includes(null)) {
    setPath(
      copyTo,
      path,
      ents.map((it) => (typeof it === 'string' ? handle(it) : it)),
    );
  }
  const updated = getPath(copyTo, path) as Json[];
  for (const ent of updated) {
    if (!isObj(ent)) continue;
    for (const prop of props) {
      if (prop !== null && ent[prop] !== undefined) ent[prop] = walkStrings(ent[prop], handle);
    }
  }
}

function replaceArr({ copyTo, info, path, fail }: ModContext, isThrow = true): boolean {
  if (!path) return false;
  const existing = getPath(copyTo, path);
  if (!Array.isArray(existing)) {
    if (isThrow) throw new CopyError(`${fail} Could not find "${path.join('.')}" array`);
    return false;
  }
  const items = asArray(info.items);
  const rep = info.replace;
  let index: number;
  if (isObj(rep) && typeof rep.regex === 'string') {
    const re = new RegExp(rep.regex, typeof rep.flags === 'string' ? rep.flags : '');
    index = existing.findIndex((it) => {
      const name = nameOf(it);
      return name !== undefined ? re.test(name) : typeof it === 'string' ? re.test(it) : false;
    });
  } else if (isObj(rep) && typeof rep.index === 'number') {
    index = rep.index;
  } else {
    index = existing.findIndex((it) =>
      nameOf(it) !== undefined ? nameOf(it) === rep : it === rep,
    );
  }
  if (index >= 0) {
    existing.splice(index, 1, ...items);
    return true;
  }
  if (isThrow)
    throw new CopyError(
      `${fail} Could not find "${path.join('.')}" item "${JSON.stringify(rep)}" to replace`,
    );
  return false;
}

function addSpells({ copyTo, info, fail }: ModContext): void {
  const spellcasting = copyTo.spellcasting;
  if (!Array.isArray(spellcasting)) throw new CopyError(`${fail} Creature has no spellcasting`);
  const trait = (
    typeof info.name === 'string'
      ? spellcasting.find((sc) => nameOf(sc) === info.name)
      : spellcasting[0]
  ) as RawEntity | undefined;
  if (!trait) throw new CopyError(`${fail} No spellcasting trait named "${String(info.name)}"`);
  if (isObj(info.spells)) {
    const spells = (trait.spells ??= {}) as Record<string, RawEntity>;
    for (const [level, category] of Object.entries(info.spells as Record<string, RawEntity>)) {
      const old = spells[level];
      if (!old) {
        spells[level] = category;
        continue;
      }
      for (const [k, v] of Object.entries(category)) {
        const prev = old[k];
        if (prev === undefined) old[k] = v;
        else if (Array.isArray(prev)) {
          old[k] = [...(prev as Json[]), ...asArray(v)].sort((a, b) =>
            String(a).toLowerCase().localeCompare(String(b).toLowerCase()),
          );
        } else old[k] = v;
      }
    }
  }
  for (const prop of ['constant', 'will', 'ritual']) {
    if (Array.isArray(info[prop])) {
      const list = (trait[prop] ??= []) as Json[];
      list.push(...(info[prop] as Json[]));
    }
  }
  for (const prop of [
    'recharge',
    'legendary',
    'charges',
    'rest',
    'restLong',
    'daily',
    'weekly',
    'monthly',
    'yearly',
  ]) {
    if (!isObj(info[prop])) continue;
    const target = (trait[prop] ??= {}) as Record<string, Json[]>;
    for (const [k, spells] of Object.entries(info[prop] as Record<string, Json[]>)) {
      (target[k] ??= []).push(...spells);
    }
  }
}

function replaceSpells({ copyTo, info, fail }: ModContext): void {
  const trait = (copyTo.spellcasting as RawEntity[] | undefined)?.[0];
  if (!trait) throw new CopyError(`${fail} Creature has no spellcasting`);
  const handle = (list: Json[], meta: RawEntity) => {
    const index = list.indexOf(meta.replace);
    if (index < 0) throw new CopyError(`${fail} Could not find spell "${String(meta.replace)}"`);
    list.splice(index, 1, ...asArray(meta.with));
    list.sort((a, b) => String(a).toLowerCase().localeCompare(String(b).toLowerCase()));
  };
  if (isObj(info.spells) && isObj(trait.spells)) {
    for (const [level, metas] of Object.entries(info.spells as Record<string, RawEntity[]>)) {
      const category = (trait.spells as Record<string, RawEntity>)[level];
      if (category && Array.isArray(category.spells))
        for (const m of metas) handle(category.spells, m);
    }
  }
  if (isObj(info.daily) && isObj(trait.daily)) {
    for (const [k, metas] of Object.entries(info.daily as Record<string, RawEntity[]>)) {
      const list = (trait.daily as Record<string, Json[]>)[k];
      if (list) for (const m of metas) handle(list, m);
    }
  }
}

function removeSpells({ copyTo, info, fail }: ModContext): void {
  const trait = (copyTo.spellcasting as RawEntity[] | undefined)?.[0];
  if (!trait) throw new CopyError(`${fail} Creature has no spellcasting`);
  if (isObj(info.spells) && isObj(trait.spells)) {
    for (const [level, remove] of Object.entries(info.spells as Record<string, Json[]>)) {
      const category = (trait.spells as Record<string, RawEntity>)[level];
      if (category && Array.isArray(category.spells)) {
        category.spells = category.spells.filter((s) => !remove.includes(s));
      }
    }
  }
  for (const prop of [
    'recharge',
    'legendary',
    'charges',
    'rest',
    'restLong',
    'daily',
    'weekly',
    'monthly',
    'yearly',
  ]) {
    if (!isObj(info[prop])) continue;
    const target = (trait[prop] ??= {}) as Record<string, Json[]>;
    for (const [k, spells] of Object.entries(info[prop] as Record<string, Json[]>)) {
      target[k] = (target[k] ?? []).filter((s) => !spells.includes(s));
    }
  }
}

function addSaves(copyTo: RawEntity, saves: Record<string, number>): void {
  const save = (copyTo.save ??= {}) as Record<string, string>;
  for (const [abil, mode] of Object.entries(saves)) {
    const total = mode * crToProficiency(copyTo.cr) + abilityMod(Number(copyTo[abil]));
    if (save[abil] === undefined || Number(save[abil]) < total) save[abil] = signed(total);
  }
}

function addSkills(copyTo: RawEntity, skills: Record<string, number>): void {
  const skill = (copyTo.skill ??= {}) as Record<string, string>;
  for (const [name, mode] of Object.entries(skills)) {
    const abil = SKILL_ABILITY[name] ?? 'str';
    const total = mode * crToProficiency(copyTo.cr) + abilityMod(Number(copyTo[abil]));
    if (skill[name] === undefined || Number(skill[name]) < total) skill[name] = signed(total);
  }
}

function scalarOnProp(ctx: ModContext, op: (n: number) => number): void {
  if (!ctx.path) return;
  const target = getPath(ctx.copyTo, ctx.path);
  if (!isObj(target)) return;
  const apply = (k: string) => {
    const out = op(Number(target[k]));
    target[k] = typeof target[k] === 'string' ? signed(out) : out;
  };
  if (ctx.info.prop === '*') Object.keys(target).forEach(apply);
  else apply(String(ctx.info.prop));
}

function applyMod(ctx: ModContext, info: ModInfo): void {
  const { copyTo, path, fail } = ctx;
  if (typeof info === 'string') {
    if (info !== 'remove') throw new CopyError(`${fail} Unhandled mode: ${info}`);
    if (path) deletePath(copyTo, path);
    return;
  }
  const c: ModContext = { ...ctx, info };
  const existing = path ? getPath(copyTo, path) : undefined;
  const existingArr = arrayOrNull(existing);
  const items = () => asArray(info.items);
  switch (info.mode) {
    case 'appendStr':
      if (path) {
        setPath(
          copyTo,
          path,
          existing ? `${text(existing)}${text(info.joiner)}${text(info.str)}` : info.str,
        );
      }
      return;
    case 'replaceName':
      replaceTxt(c, true);
      return;
    case 'replaceTxt':
      replaceTxt(c);
      return;
    case 'prependArr':
      if (path) setPath(copyTo, path, existingArr ? [...items(), ...existingArr] : items());
      return;
    case 'appendArr':
      if (path) setPath(copyTo, path, existingArr ? [...existingArr, ...items()] : items());
      return;
    case 'appendIfNotExistsArr':
      if (!path) return;
      if (!existingArr) {
        setPath(copyTo, path, items());
        return;
      }
      setPath(copyTo, path, [
        ...existingArr,
        ...items().filter((it) => !existingArr.some((x) => deepEquals(it, x))),
      ]);
      return;
    case 'replaceArr':
      replaceArr(c);
      return;
    case 'replaceOrAppendArr':
      if (!replaceArr(c, false) && path) {
        const now = arrayOrNull(getPath(copyTo, path));
        setPath(copyTo, path, now ? [...now, ...items()] : items());
      }
      return;
    case 'insertArr': {
      if (!existingArr) throw new CopyError(`${fail} Could not find array to insert into`);
      const index =
        typeof info.index === 'number' && info.index !== -1 ? info.index : existingArr.length;
      existingArr.splice(index, 0, ...items());
      return;
    }
    case 'removeArr': {
      if (!existingArr) throw new CopyError(`${fail} Could not find array to remove from`);
      if (info.names !== undefined) {
        for (const name of asArray(info.names)) {
          const index = existingArr.findIndex((it) => nameOf(it) === name);
          if (index >= 0) existingArr.splice(index, 1);
          else if (info.force !== true)
            throw new CopyError(`${fail} Could not find "${String(name)}" to remove`);
        }
      } else if (info.items !== undefined) {
        for (const item of items()) {
          const index = existingArr.findIndex((it) => it === item);
          if (index >= 0) existingArr.splice(index, 1);
          else throw new CopyError(`${fail} Could not find item "${String(item)}" to remove`);
        }
      } else throw new CopyError(`${fail} removeArr needs "names" or "items"`);
      return;
    }
    case 'renameArr':
      if (!existingArr) throw new CopyError(`${fail} Could not find array to rename in`);
      for (const r of asArray(info.renames) as RawEntity[]) {
        const ent = existingArr.find((it) => nameOf(it) === r.rename);
        if (!isObj(ent))
          throw new CopyError(`${fail} Could not find "${String(r.rename)}" to rename`);
        ent.name = r.with;
      }
      return;
    case 'calculateProp': {
      if (!path) return;
      const target = (getPath(copyTo, path) ??
        (setPath(copyTo, path, {}), getPath(copyTo, path))) as RawEntity;
      const formula = String(info.formula).replace(/<\$([^$]+)\$>/g, (_m, v: string) => {
        if (v === 'prof_bonus') return String(crToProficiency(copyTo.cr));
        if (v === 'dex_mod') return String(abilityMod(Number(copyTo.dex)));
        throw new CopyError(`${fail} Unknown variable "${v}"`);
      });
      target[String(info.prop)] = evalMath(formula);
      return;
    }
    case 'scalarAddProp':
      scalarOnProp(c, (n) => n + Number(info.scalar));
      return;
    case 'scalarMultProp':
      scalarOnProp(c, (n) => {
        const out = n * Number(info.scalar);
        return info.floor === true ? Math.floor(out) : out;
      });
      return;
    case 'setProp':
    case 'prefixSuffixStringProp': {
      const combined = typeof info.prop === 'string' ? info.prop.split('.') : [];
      if (path && !(path.length === 1 && path[0] === '*')) combined.unshift(...path);
      if (info.mode === 'setProp') {
        setPath(copyTo, combined, clone(info.value));
        return;
      }
      const str = getPath(copyTo, combined);
      if (typeof str === 'string') {
        setPath(copyTo, combined, `${text(info.prefix)}${str}${text(info.suffix)}`);
      }
      return;
    }
    case 'addSenses': {
      const senses = (copyTo.senses ??= []) as string[];
      for (const sense of asArray(info.senses) as RawEntity[]) {
        const type = String(sense.type);
        const range = Number(sense.range);
        const index = senses.findIndex((s) => new RegExp(`${type} (\\d+)`, 'i').test(s));
        if (index >= 0) {
          const current = Number(new RegExp(`${type} (\\d+)`, 'i').exec(senses[index] ?? '')?.[1]);
          if (current < range) senses[index] = `${type} ${String(range)} ft.`;
        } else senses.push(`${type} ${String(range)} ft.`);
      }
      return;
    }
    case 'addSaves':
      addSaves(copyTo, info.saves as Record<string, number>);
      return;
    case 'addSkills':
      addSkills(copyTo, info.skills as Record<string, number>);
      return;
    case 'addAllSaves':
      addSaves(copyTo, Object.fromEntries(ABILITIES.map((a) => [a, Number(info.saves)])));
      return;
    case 'addAllSkills':
      addSkills(
        copyTo,
        Object.fromEntries(Object.keys(SKILL_ABILITY).map((s) => [s, Number(info.skills)])),
      );
      return;
    case 'addSpells':
      addSpells(c);
      return;
    case 'replaceSpells':
      replaceSpells(c);
      return;
    case 'removeSpells':
      removeSpells(c);
      return;
    case 'scalarAddHit':
      if (path && existing !== undefined) {
        setPath(
          copyTo,
          path,
          walkStrings(existing, (s) =>
            s.replace(
              /{@hit ([-+]?\d+)}/g,
              (_m, n: string) => `{@hit ${String(Number(n) + Number(info.scalar))}}`,
            ),
          ),
        );
      }
      return;
    case 'scalarAddDc':
      if (path && existing !== undefined) {
        setPath(
          copyTo,
          path,
          walkStrings(existing, (s) =>
            s.replace(
              /{@dc (\d+)(?:\|[^}]+)?}/g,
              (_m, n: string) => `{@dc ${String(Number(n) + Number(info.scalar))}}`,
            ),
          ),
        );
      }
      return;
    case 'maxSize': {
      const current = (Array.isArray(copyTo.size) ? copyTo.size : []) as string[];
      const max = SIZES.indexOf(String(info.max));
      const kept = current.map((s) => SIZES.indexOf(s)).filter((i) => i >= 0 && i <= max);
      copyTo.size = (kept.length ? kept : [max]).map((i) => SIZES[i]);
      return;
    }
    case 'scalarMultXp': {
      const scale = (xp: number) => {
        const out = xp * Number(info.scalar);
        return info.floor === true ? Math.floor(out) : out;
      };
      if (isObj(copyTo.cr) && typeof copyTo.cr.xp === 'number') copyTo.cr.xp = scale(copyTo.cr.xp);
      else {
        const crKey = isObj(copyTo.cr) ? String(copyTo.cr.cr) : String(copyTo.cr);
        const cr: RawEntity = isObj(copyTo.cr) ? copyTo.cr : { cr: copyTo.cr };
        cr.xp = scale(XP_BY_CR[crKey] ?? 0);
        copyTo.cr = cr;
      }
      return;
    }
    default:
      throw new CopyError(`${fail} Unhandled mode: ${String(info.mode)}`);
  }
}

// endregion

/** Raw lookup of an entity of `type` by its key. */
export type EntityLookup = (type: string, key: string) => RawEntity | undefined;

/**
 * Resolves `_copy` entities against their parents. Memoises results; detects cycles.
 * Use one resolver per index build so parents are resolved once.
 */
export class CopyResolver {
  private readonly resolved = new Map<string, RawEntity>();
  private readonly inProgress = new Set<string>();

  constructor(private readonly lookup: EntityLookup) {}

  /** Key of the entity a `_copy` points at, built with the same identity rules as indexing. */
  static parentKey(type: string, entity: RawEntity): string | null {
    const meta = entity._copy;
    if (!isObj(meta)) return null;
    // Composite identities (subclass, classFeature…) inherit their extra parts from the child.
    const probe: RawEntity = { ...entity, ...meta };
    delete probe._copy;
    return identify(type, probe)?.key ?? null;
  }

  /** The fully resolved form of an entity (unchanged if it has no `_copy`). */
  resolve(type: string, key: string, entity: RawEntity): RawEntity {
    if (!isObj(entity._copy)) return entity;
    const cached = this.resolved.get(key);
    if (cached) return cached;
    if (this.inProgress.has(key)) throw new CopyError(`Copy cycle at ${key}`);
    this.inProgress.add(key);
    try {
      const parentKey = CopyResolver.parentKey(type, entity);
      if (!parentKey || parentKey === key) throw new CopyError(`${key}: invalid _copy target`);
      const parentRaw = this.lookup(type, parentKey);
      if (!parentRaw) throw new CopyError(`${key}: copy target ${parentKey} not found`);
      const parent = this.resolve(type, parentKey, parentRaw);
      const result = this.apply(type, key, clone(parent), clone(entity));
      this.resolved.set(key, result);
      return result;
    } finally {
      this.inProgress.delete(key);
    }
  }

  private apply(type: string, key: string, copyFrom: RawEntity, copyTo: RawEntity): RawEntity {
    const fail = `Failed to apply _copy to ${key}.`;
    const meta = copyTo._copy as RawEntity;
    const mods: Record<string, ModInfo[]> = {};
    if (isObj(meta._mod)) {
      for (const [k, v] of Object.entries(meta._mod)) mods[k] = asArray(v) as ModInfo[];
    }

    // Templates (monster/legendary group): merge their mods, remember their root props.
    const templates: RawEntity[] = [];
    if (Array.isArray(meta._templates) && meta._templates.length > 0) {
      const templateType = TEMPLATE_TYPES[type];
      if (!templateType) throw new CopyError(`${fail} Templates are not supported for ${type}`);
      for (const ref of meta._templates as RawEntity[]) {
        const tKey = identify(templateType, ref)?.key;
        const template = tKey ? this.lookup(templateType, tKey) : undefined;
        if (!template)
          throw new CopyError(
            `${fail} Template ${String(ref.name)} (${String(ref.source)}) not found`,
          );
        const t = clone(template);
        templates.push(t);
        const apply = isObj(t.apply) ? t.apply : {};
        if (isObj(apply._mod)) {
          for (const [k, v] of Object.entries(apply._mod)) {
            mods[k] = [...(mods[k] ?? []), ...(asArray(v) as ModInfo[])];
          }
        }
      }
      copyTo._copy_templates = (meta._templates as RawEntity[]).map(({ name, source }) => ({
        name,
        source,
      }));
    }

    const ownProps = new Set(Object.keys(copyTo));
    const preserve = isObj(meta._preserve) ? meta._preserve : {};
    const typePreserve = new Set(PRESERVE_BY_TYPE[type] ?? []);
    for (const k of Object.keys(copyFrom)) {
      if (copyTo[k] === null) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete copyTo[k];
        continue;
      }
      if (copyTo[k] !== undefined) continue;
      if (PRESERVE_BASE.has(k) || typePreserve.has(k)) {
        if (preserve['*'] === true || preserve[k] === true) copyTo[k] = copyFrom[k];
      } else copyTo[k] = copyFrom[k];
    }

    for (const t of templates) {
      const root = isObj(t.apply) && isObj(t.apply._root) ? t.apply._root : {};
      for (const [k, v] of Object.entries(root)) if (!ownProps.has(k)) copyTo[k] = clone(v);
    }

    // Placeholders resolve against the merged entity before any mod runs, as in 5etools.
    const resolvedMods = Object.entries(mods).map(
      ([prop, infos]) => [prop, resolveVariables(infos, copyTo) as ModInfo[]] as const,
    );
    const order = (k: string) => (k === '_' ? 1 : k === '*' ? 2 : 0);
    for (const [prop, resolvedInfos] of resolvedMods.sort(([a], [b]) => order(a) - order(b))) {
      const paths: (string[] | null)[] =
        prop === '*' ? COPY_ENTRY_PROPS.map((p) => [p]) : prop === '_' ? [null] : [prop.split('.')];
      for (const path of paths) {
        for (const info of resolvedInfos) {
          applyMod({ copyTo, info: {}, path, fail }, info);
        }
      }
    }

    copyTo._isCopy = true;
    delete copyTo._copy;
    return copyTo;
  }
}
