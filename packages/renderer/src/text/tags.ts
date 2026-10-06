import { identify, type RawEntity } from '@boh/data5e';
import { splitArgs } from './splitTags';

/**
 * What a `{@tag ...}` means, independent of how it is drawn. Mirrors the argument layouts and
 * default sources of the 5etools renderer (js/render.js, v2.36.1).
 */

export type FormatKind =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'sup'
  | 'sub'
  | 'kbd'
  | 'code'
  | 'note'
  | 'highlight'
  | 'smallCaps'
  | 'plain';

export type RollKind = 'dice' | 'damage' | 'd20' | 'chance' | 'recharge' | 'coin';

export interface RollSpec {
  kind: RollKind;
  /** Dice expression, e.g. `1d20 + 5`; `;` separates alternatives. */
  expression: string;
  /** What is being rolled, e.g. a weapon or spell name (filled in by the renderer context). */
  label?: string;
  /** Success when the total is at least / at most this (recharge, chance). */
  success?: { atLeast?: number; atMost?: number };
  /** Spell scaling: roll `base` plus `step` per level above `minLevel`. */
  scale?: { base: string; step: string; minLevel: number; maxLevel: number };
}

export type TagModel =
  | { kind: 'format'; format: FormatKind; content: string; color?: string }
  | { kind: 'entity'; tag: string; display: string; candidates: string[] }
  | { kind: 'roll'; display: string; roll: RollSpec }
  | { kind: 'label'; text: string; italic: boolean }
  | {
      kind: 'reference';
      ref: 'book' | 'adventure' | 'quickref' | 'area' | 'filter' | 'site';
      display: string;
      args: string[];
    }
  | { kind: 'external'; display: string; url: string }
  | { kind: 'tooltip'; display: string; tip: string }
  | { kind: 'image'; display: string; path: string }
  | { kind: 'unknown'; name: string; display: string };

/** Default source when a tag omits it (5etools `Renderer.tag` defaults). */
export const TAG_DEFAULT_SOURCE: Record<string, string> = {
  action: 'PHB', background: 'PHB', boon: 'MTF', card: 'DMG', charoption: 'MOT', class: 'PHB',
  classFeature: 'PHB', condition: 'PHB', creature: 'MM', creatureFluff: 'MM', crochet: 'CaBoMP',
  cult: 'MTF', deck: 'DMG', deity: 'PHB', disease: 'DMG', facility: 'XDMG', feat: 'PHB',
  hazard: 'DMG', item: 'DMG', itemMastery: 'XPHB', itemProperty: 'PHB', language: 'PHB',
  legroup: 'MM', object: 'DMG', optfeature: 'PHB', psionic: 'UATheMysticClass', quickref: 'PHB',
  race: 'PHB', recipe: 'HF', reward: 'DMG', sense: 'PHB', skill: 'PHB', spell: 'PHB',
  status: 'PHB', subclass: 'PHB', subclassFeature: 'PHB', table: 'DMG', trap: 'DMG',
  variantrule: 'DMG', vehicle: 'GoS', vehupgrade: 'GoS',
}; // prettier-ignore

/** Entity types a tag can point at, primary first (5etools `Parser.TAG_TO_PROPS`). */
const TAG_TYPES: Record<string, string[]> = {
  creature: ['monster'],
  creatureFluff: ['monsterFluff'],
  optfeature: ['optionalfeature'],
  table: ['table', 'tableGroup'],
  vehupgrade: ['vehicleUpgrade'],
  item: ['item', 'baseitem', 'itemGroup', 'magicvariant'],
  crochet: ['crochetPattern'],
  legroup: ['legendaryGroup'],
};

const FORMAT_TAGS: Record<string, FormatKind> = {
  b: 'bold', bold: 'bold', i: 'italic', italic: 'italic', u: 'underline', underline: 'underline',
  s: 'strike', strike: 'strike', s2: 'strike', strikeDouble: 'strike', sup: 'sup', sub: 'sub',
  kbd: 'kbd', code: 'code', note: 'note', highlight: 'highlight', cite: 'italic',
  comic: 'plain', comicH1: 'bold', comicH2: 'bold', comicH3: 'bold', comicH4: 'bold',
  comicNote: 'note',
}; // prettier-ignore

const ABILITIES: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom',
  cha: 'Charisma',
}; // prettier-ignore

const ATK: Record<string, string> = {
  m: 'Melee Attack:', r: 'Ranged Attack:', mw: 'Melee Weapon Attack:',
  rw: 'Ranged Weapon Attack:', ms: 'Melee Spell Attack:', rs: 'Ranged Spell Attack:',
  'mw,rw': 'Melee or Ranged Weapon Attack:', 'ms,rs': 'Melee or Ranged Spell Attack:',
  'm,r': 'Melee or Ranged Attack:', 'mw,rs': 'Melee Weapon or Ranged Spell Attack:',
  'ms,rw': 'Melee Spell or Ranged Weapon Attack:',
}; // prettier-ignore

const ATKR: Record<string, string> = {
  m: 'Melee Attack Roll:', r: 'Ranged Attack Roll:', 'm,r': 'Melee or Ranged Attack Roll:',
}; // prettier-ignore

const signed = (n: number) => (n >= 0 ? `+${String(n)}` : `−${String(Math.abs(n))}`);

/** `+5` / `5` / `-1` → `1d20 + 5` / `1d20 - 1`. */
function d20Plus(bonus: string): string {
  const n = Number(bonus.replace('−', '-'));
  if (!Number.isFinite(n) || n === 0) return '1d20';
  return n > 0 ? `1d20 + ${String(n)}` : `1d20 - ${String(Math.abs(n))}`;
}

/** Display form of a dice expression: `2d4×10` → `2d4 × 10`. */
function prettyDice(expr: string): string {
  return expr.replace(/\s*[x×*]\s*/g, ' × ').replace(/#\$prompt_number[^$]*\$#/g, '…');
}

/**
 * Stands for an identity part the tag doesn't state (a subrace's parent source, a deity's
 * pantheon). The index resolves candidates containing it with a pattern match.
 */
export const ANY = '*';

/** Builds the index key(s) a link could resolve to, using the same identity rules as indexing. */
function keysFor(types: string[], fields: RawEntity): string[] {
  const keys: string[] = [];
  for (const type of types) {
    const id = identify(type, fields);
    if (id) keys.push(id.key);
  }
  return keys;
}

function entityTag(tag: string, args: string[]): TagModel {
  const a = (i: number) => args[i] ?? '';
  const src = (s: string) => s || (TAG_DEFAULT_SOURCE[tag] ?? 'PHB');
  const types = TAG_TYPES[tag] ?? [tag];

  switch (tag) {
    case 'class':
      return {
        kind: 'entity',
        tag,
        display: a(2) || a(0),
        candidates: keysFor(['class'], { name: a(0), source: src(a(1)) }),
      };
    case 'subclass':
      // shortName|className|classSource|source|display
      return {
        kind: 'entity',
        tag,
        display: a(4) || a(0),
        candidates: keysFor(['subclass'], {
          name: a(0),
          shortName: a(0),
          className: a(1),
          classSource: src(a(2)),
          source: src(a(3)),
        }),
      };
    case 'classFeature':
      // name|className|classSource|level|source|display
      return {
        kind: 'entity',
        tag,
        display: a(5) || a(0),
        // An omitted feature source means the class's own source.
        candidates: keysFor(['classFeature'], {
          name: a(0),
          className: a(1),
          classSource: src(a(2)),
          level: Number(a(3)),
          source: a(4) || src(a(2)),
        }),
      };
    case 'subclassFeature':
      // name|className|classSource|subclassShortName|subclassSource|level|source|display
      return {
        kind: 'entity',
        tag,
        display: a(7) || a(0),
        candidates: keysFor(['subclassFeature'], {
          name: a(0),
          className: a(1),
          classSource: src(a(2)),
          subclassShortName: a(3),
          subclassSource: src(a(4)),
          level: Number(a(5)),
          source: a(6) || src(a(4)),
        }),
      };
    case 'card':
      // name|set|source|display
      return {
        kind: 'entity',
        tag,
        display: a(3) || a(0),
        candidates: keysFor(['card'], { name: a(0), set: a(1), source: src(a(2)) }),
      };
    case 'deity':
      // name|pantheon|source|display
      return {
        kind: 'entity',
        tag,
        display: a(3) || a(0),
        candidates: keysFor(['deity'], { name: a(0), pantheon: a(1) || ANY, source: src(a(2)) }),
      };
    case 'itemProperty':
      return {
        kind: 'entity',
        tag,
        display: a(2) || a(0),
        candidates: keysFor(['itemProperty'], { abbreviation: a(0), source: src(a(1)) }),
      };
    case 'race': {
      // "Elf (High)" may name a subrace.
      const sub = /^(.*?)\s*\((.+)\)$/.exec(a(0));
      const source = src(a(1));
      const candidates = keysFor(['race'], { name: a(0), source });
      if (sub?.[1] && sub[2]) {
        candidates.push(
          ...keysFor(['subrace'], { name: sub[2], raceName: sub[1], raceSource: source, source }),
          // The parent race is often from another book (Dwarf PHB, Duergar MTF).
          ...keysFor(['subrace'], { name: sub[2], raceName: sub[1], raceSource: ANY, source }),
        );
      }
      return { kind: 'entity', tag, display: a(2) || a(0), candidates };
    }
    default:
      return {
        kind: 'entity',
        tag,
        display: a(2) || a(0),
        candidates: keysFor(types, { name: a(0), source: src(a(1)) }),
      };
  }
}

/** Interprets one tag. `body` is everything after the tag name. */
export function describeTag(name: string, body: string): TagModel {
  const args = splitArgs(body);
  const a = (i: number) => args[i] ?? '';

  const format = FORMAT_TAGS[name];
  if (format) return { kind: 'format', format, content: body };

  switch (name) {
    case 'style':
      return {
        kind: 'format',
        format: a(1).includes('small-caps')
          ? 'smallCaps'
          : a(1).includes('bold')
            ? 'bold'
            : 'plain',
        content: a(0),
      };
    case 'font':
      return { kind: 'format', format: 'plain', content: a(0) };
    case 'color':
      return { kind: 'format', format: 'plain', content: a(0), color: a(1) };
    case 'unit': {
      const amount = Number(a(0));
      const word = amount === 1 ? a(1) : a(2) || `${a(1)}s`;
      return { kind: 'label', text: word, italic: false };
    }
    case 'help':
    case 'tip':
      return { kind: 'tooltip', display: a(0), tip: a(1) };
    case 'footnote':
      return { kind: 'tooltip', display: a(0), tip: a(1) };
    case 'homebrew':
      return { kind: 'format', format: 'plain', content: a(0) };

    // Labels
    case 'dc':
      return { kind: 'label', text: `DC ${a(1) || a(0)}`, italic: false };
    case 'dcYourSpellSave':
      return { kind: 'label', text: a(0) || 'your spell save DC', italic: false };
    case 'hitYourSpellAttack':
      return { kind: 'label', text: a(0) || 'your spell attack modifier', italic: false };
    case 'atk':
      return { kind: 'label', text: ATK[a(0)] ?? 'Attack:', italic: true };
    case 'atkr':
      return { kind: 'label', text: ATKR[a(0)] ?? 'Attack Roll:', italic: true };
    case 'h':
      return { kind: 'label', text: 'Hit:', italic: true };
    case 'm':
      return { kind: 'label', text: 'Miss:', italic: true };
    case 'hom':
      return { kind: 'label', text: 'Hit or Miss:', italic: true };
    case 'actSave':
      return { kind: 'label', text: `${ABILITIES[a(0)] ?? a(0)} Saving Throw:`, italic: true };
    case 'actSaveFail':
      return {
        kind: 'label',
        text: a(0) ? `Failure by ${a(0)} or More:` : 'Failure:',
        italic: true,
      };
    case 'actSaveFailBy':
      return { kind: 'label', text: `Failure by ${a(0)} or More:`, italic: true };
    case 'actSaveSuccess':
      return { kind: 'label', text: 'Success:', italic: true };
    case 'actSaveSuccessOrFail':
      return { kind: 'label', text: 'Failure or Success:', italic: true };
    case 'actTrigger':
      return { kind: 'label', text: 'Trigger:', italic: true };
    case 'actResponse':
      return { kind: 'label', text: 'Response:', italic: true };

    // Rolls
    case 'dice':
    case 'autodice':
    case 'damage':
      return {
        kind: 'roll',
        display: a(1) || prettyDice(a(0)),
        roll: {
          kind: name === 'damage' ? 'damage' : 'dice',
          expression: a(0),
          ...(a(2) ? { label: a(2) } : {}),
        },
      };
    case 'hit':
    case 'd20': {
      const n = Number(a(0).replace('−', '-'));
      return {
        kind: 'roll',
        display: a(1) || (Number.isFinite(n) ? signed(n) : a(0)),
        roll: { kind: 'd20', expression: d20Plus(a(0)), ...(a(2) ? { label: a(2) } : {}) },
      };
    }
    case 'savingThrow':
    case 'skillCheck': {
      // `con 3` / `athletics 4`
      const match = /^(.*?)\s+([+-]?\d+)$/.exec(a(0));
      const bonus = Number(match?.[2] ?? 0);
      const what = match?.[1] ?? '';
      const label =
        name === 'savingThrow'
          ? `${ABILITIES[what] ?? what} save`
          : what.replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        kind: 'roll',
        display: a(1) || signed(bonus),
        roll: { kind: 'd20', expression: d20Plus(String(bonus)), label },
      };
    }
    case 'ability': {
      // `str 18` → 18 (+4)
      const match = /^(\w+)\s+(\d+)$/.exec(a(0));
      const score = Number(match?.[2] ?? 10);
      const mod = Math.floor((score - 10) / 2);
      return {
        kind: 'roll',
        display: a(1) || `${String(score)} (${signed(mod)})`,
        roll: {
          kind: 'd20',
          expression: d20Plus(String(mod)),
          label: `${ABILITIES[match?.[1] ?? ''] ?? ''} check`.trim(),
        },
      };
    }
    case 'recharge': {
      const min = Number(a(0) || 6);
      return {
        kind: 'roll',
        display: a(1) || (min >= 6 ? '(Recharge 6)' : `(Recharge ${String(min)}–6)`),
        roll: { kind: 'recharge', expression: '1d6', success: { atLeast: min }, label: 'Recharge' },
      };
    }
    case 'chance': {
      const pct = Number(a(0));
      return {
        kind: 'roll',
        display: a(1) || `${a(0)} percent`,
        roll: {
          kind: 'chance',
          expression: '1d100',
          success: { atMost: pct },
          ...(a(2) ? { label: a(2) } : {}),
        },
      };
    }
    case 'coinflip':
      return {
        kind: 'roll',
        display: a(0) || 'flip a coin',
        roll: { kind: 'coin', expression: '1d2', label: 'Coin flip' },
      };
    case 'scaledice':
    case 'scaledamage': {
      // base|minLevel-maxLevel|step|scaleOptions|display
      const [min, max] = a(1).split('-').map(Number);
      return {
        kind: 'roll',
        display: a(4) || prettyDice(a(2)),
        roll: {
          kind: name === 'scaledamage' ? 'damage' : 'dice',
          expression: a(2),
          scale: { base: a(0), step: a(2), minLevel: min ?? 1, maxLevel: max ?? min ?? 9 },
        },
      };
    }

    // References inside books, filters, external links
    case 'book':
    case 'adventure':
    case 'quickref':
    case 'area':
    case 'filter':
      return { kind: 'reference', ref: name, display: a(0), args };
    case '5etools':
      return { kind: 'reference', ref: 'site', display: a(0), args };
    case 'link':
      return { kind: 'external', display: a(0), url: a(1) };
    case '5etoolsImg':
      return { kind: 'image', display: a(0), path: a(1) };
    case '5etoolsAudio':
      return { kind: 'label', text: a(0), italic: false };
  }

  if (name in TAG_DEFAULT_SOURCE || name in TAG_TYPES) return entityTag(name, args);
  return { kind: 'unknown', name, display: a(0) };
}
