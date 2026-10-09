import { ABILITY_NAME } from '../format';
import { arr, isObj, text, type Obj } from '../json';
import { stripTagsPlain } from './strip';

/** What an art card shows for a class or species (see the `cards` list layout). */
export interface CardInfo {
  /**
   * Repo-relative 5etools image path, e.g. `classes/XPHB/Fighter.webp`, or a homebrew picture's
   * address (a `data:` URL or `https://`).
   */
  image?: string;
  /** Short heading such as "A Master of All Arms and Armor". */
  tagline?: string;
  /** One or two sentences of introduction. */
  blurb?: string;
  /** Key facts as label/value pairs. */
  facts: [string, string][];
}

const abilityName = (code: string) =>
  (ABILITY_NAME as Partial<Record<string, string>>)[code] ?? code.toUpperCase();
const joinAnd = (xs: string[]) => xs.join(' & ');

/** The first plain-text paragraph in a tree of entries. */
function firstParagraph(entries: unknown): string | undefined {
  for (const e of arr(entries)) {
    if (typeof e === 'string') return e;
    if (isObj(e) && (e.type === undefined || e.type === 'entries' || e.type === 'section')) {
      const found = firstParagraph(e.entries);
      if (found) return found;
    }
  }
  return undefined;
}

/** The first sentences of a paragraph, about one to two lines of a card. */
export function blurbOf(paragraph: string, min = 90, max = 220): string {
  const plain = stripTagsPlain(paragraph).replace(/\s+/g, ' ').trim();
  const sentences = plain.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [plain];
  let out = '';
  for (const s of sentences) {
    if (out.length >= min) break;
    out += s;
  }
  out = out.trim();
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
}

/** "Strength or Dexterity", "Dexterity & Wisdom" from 2024 `primaryAbility` or 2014 multiclassing. */
function primaryAbility(cls: Obj): string | undefined {
  const options = arr(cls.primaryAbility).filter(isObj);
  if (options.length > 0) {
    return options.map((o) => joinAnd(Object.keys(o).map(abilityName))).join(' or ');
  }
  const req = isObj(cls.multiclassing) ? cls.multiclassing.requirements : undefined;
  if (!isObj(req)) return undefined;
  if (Array.isArray(req.or)) {
    return req.or
      .filter(isObj)
      .flatMap((o) => Object.keys(o).map(abilityName))
      .join(' or ');
  }
  const keys = Object.keys(req).filter((k) => k in ABILITY_NAME);
  return keys.length > 0 ? joinAnd(keys.map(abilityName)) : undefined;
}

/** Standard species lines that every species has; the card lists the distinctive traits. */
const COMMON_TRAITS = new Set([
  'age',
  'alignment',
  'size',
  'speed',
  'languages',
  'language',
  'creature type',
]);

function speciesTraits(race: Obj): string[] {
  return arr(race.entries)
    .filter(isObj)
    .map((e) => stripTagsPlain(text(e.name)))
    .filter((name) => name !== '' && !COMMON_TRAITS.has(name.toLowerCase()));
}

export function buildCard(type: string, data: Obj, fluff: Obj | undefined): CardInfo {
  const images = arr(fluff?.images).filter(isObj);
  const href = isObj(images[0]?.href) ? images[0].href : undefined;
  const image =
    href?.type === 'internal' ? text(href.path) : href?.type === 'external' ? text(href.url) : '';
  const paragraph = firstParagraph(fluff?.entries);
  const card: CardInfo = { facts: [] };
  if (image) card.image = image;
  if (paragraph) card.blurb = blurbOf(paragraph);

  if (type === 'class') {
    const tagline = text(images[0]?.title);
    if (tagline) card.tagline = tagline;
    const primary = primaryAbility(data);
    if (primary) card.facts.push(['Primary ability', primary]);
    if (isObj(data.hd)) card.facts.push(['Hit point die', `D${text(data.hd.faces)}`]);
    const saves = arr(data.proficiency).map((s) => abilityName(text(s)));
    if (saves.length > 0) card.facts.push(['Saves', joinAnd(saves)]);
  } else {
    const traits = speciesTraits(data);
    if (traits.length > 0) card.facts.push(['Traits', traits.join(', ')]);
  }
  return card;
}
