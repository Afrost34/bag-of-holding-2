import { parseWikiLinks, type WikiLink } from './syntax';

/**
 * What a link points at: another note, a compendium entry, or an attachment (image, PDF).
 * Note links follow Obsidian: a name or a partial path, without `.md`, case-insensitive; when
 * several notes match, the one in the linking note's folder wins, then the shortest path.
 */

/** Compendium link types as written in notes, mapped to 5etools entity types. */
const COMPENDIUM_TYPES: Record<string, string> = {
  spell: 'spell',
  creature: 'monster',
  monster: 'monster',
  item: 'item',
  species: 'race',
  race: 'race',
  subrace: 'subrace',
  class: 'class',
  subclass: 'subclass',
  background: 'background',
  feat: 'feat',
  condition: 'condition',
  disease: 'disease',
  deity: 'deity',
  option: 'optionalfeature',
  optionalfeature: 'optionalfeature',
  rule: 'variantrule',
  variantrule: 'variantrule',
  action: 'action',
  table: 'table',
  vehicle: 'vehicle',
  object: 'object',
  trap: 'trap',
  hazard: 'hazard',
  language: 'language',
  reward: 'reward',
  facility: 'facility',
};

export interface CompendiumRef {
  /** 5etools entity type, e.g. `monster` for `creature:`. */
  type: string;
  name: string;
  /** Absent: the campaign's preferred edition decides (`[[creature:Goblin]]`). */
  source?: string;
}

/** `spell:Fireball@XPHB`, `creature:Goblin` → a compendium reference; anything else → null. */
export function parseCompendiumRef(target: string): CompendiumRef | null {
  const m = /^([a-z]+):([^@/\\]+?)(?:@([\w-]+))?$/i.exec(target.trim());
  if (!m) return null;
  const type = COMPENDIUM_TYPES[(m[1] ?? '').toLowerCase()];
  if (!type) return null;
  const ref: CompendiumRef = { type, name: (m[2] ?? '').trim() };
  if (m[3]) ref.source = m[3];
  return ref;
}

const ATTACHMENT = /\.(base|png|jpe?g|gif|webp|svg|bmp|avif|pdf|mp3|wav|ogg|mp4|webm)$/i;

export function isAttachment(target: string): boolean {
  return ATTACHMENT.test(target);
}

/** `a/b/../c/./d` → `a/c/d`; null when `..` climbs above the journal. */
function normalizePath(path: string): string | null {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length === 0) return null;
      out.pop();
    } else out.push(part);
  }
  return out.join('/');
}

const norm = (s: string) => s.replace(/\\/g, '/').replace(/\.md$/i, '').toLowerCase();
const folderOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/** `Places/Waterdeep.md` → `Waterdeep` */
export function noteName(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return base.replace(/\.md$/i, '');
}

/**
 * The file a link target refers to among `paths` (vault-relative, `Places/Waterdeep.md`), or
 * null. Works for notes (`.md` optional) and attachments (exact file name).
 */
export function resolveLinkPath(
  target: string,
  paths: readonly string[],
  fromPath?: string,
): string | null {
  // `../Factions/Red_Fangs` and `./Ward`: relative to the linking note's folder.
  if (/^\.\.?\//.test(target)) {
    if (!fromPath) return null;
    const joined = normalizePath(`${folderOf(fromPath)}/${target}`);
    if (joined === null) return null;
    return resolveLinkPath(joined, paths);
  }
  const wanted = norm(target).replace(/^\/+/, '');
  if (!wanted) return null;
  const attachment = isAttachment(target);
  const candidates = paths.filter((p) => {
    if (attachment !== isAttachment(p)) return false;
    if (!attachment && !/\.md$/i.test(p)) return false;
    const key = norm(p);
    return key === wanted || key.endsWith(`/${wanted}`);
  });
  // A path that leads nowhere (the note was moved since): fall back to the note's name.
  if (candidates.length === 0 && wanted.includes('/')) {
    return resolveLinkPath(wanted.slice(wanted.lastIndexOf('/') + 1), paths, fromPath);
  }
  if (candidates.length <= 1) return candidates[0] ?? null;
  const here = fromPath ? folderOf(fromPath).toLowerCase() : null;
  return (
    [...candidates].sort((a, b) => {
      const sameA = here !== null && folderOf(a).toLowerCase() === here ? 0 : 1;
      const sameB = here !== null && folderOf(b).toLowerCase() === here ? 0 : 1;
      return sameA - sameB || a.length - b.length || a.localeCompare(b);
    })[0] ?? null
  );
}

/** The shortest link target that still resolves to `path` (its name when that is unique). */
export function linkTargetFor(path: string, paths: readonly string[]): string {
  const name = noteName(path);
  const clashing = paths.filter(
    (p) => p !== path && noteName(p).toLowerCase() === name.toLowerCase(),
  );
  return clashing.length === 0 ? name : path.replace(/\.md$/i, '');
}

export interface Backlink {
  /** The note that links here. */
  from: string;
  link: WikiLink;
}

export interface JournalIndex {
  /** Links found in each note. */
  links: Map<string, WikiLink[]>;
  /** For each note path: the notes linking to it. */
  backlinks: Map<string, Backlink[]>;
  /** Note links that match no note (Obsidian shows them as "not created yet"). */
  unresolved: Backlink[];
}

export function buildIndex(notes: ReadonlyMap<string, string>): JournalIndex {
  const paths = [...notes.keys()];
  const links = new Map<string, WikiLink[]>();
  const backlinks = new Map<string, Backlink[]>();
  const unresolved: Backlink[] = [];
  for (const [from, text] of notes) {
    const found = parseWikiLinks(text);
    links.set(from, found);
    for (const link of found) {
      if (parseCompendiumRef(link.target) || !link.target) continue;
      const to = resolveLinkPath(link.target, paths, from);
      if (!to) {
        if (!isAttachment(link.target)) unresolved.push({ from, link });
        continue;
      }
      backlinks.set(to, [...(backlinks.get(to) ?? []), { from, link }]);
    }
  }
  return { links, backlinks, unresolved };
}

/**
 * Rewrites links in `text` (the note at `fromPath`) that pointed at `oldPath` so they point at
 * `newPath`, keeping headings and display text. `pathsAfter` lists every file after the rename.
 */
export function updateLinksForRename(
  text: string,
  fromPath: string,
  oldPath: string,
  newPath: string,
  pathsBefore: readonly string[],
  pathsAfter: readonly string[],
): string {
  const found = parseWikiLinks(text).filter(
    (l) =>
      !parseCompendiumRef(l.target) && resolveLinkPath(l.target, pathsBefore, fromPath) === oldPath,
  );
  if (found.length === 0) return text;
  const target = linkTargetFor(newPath, pathsAfter);
  let out = '';
  let last = 0;
  for (const l of found) {
    const suffix =
      (l.heading ? `#${l.heading}` : l.block ? `#^${l.block}` : '') +
      (l.display ? `|${l.display}` : '');
    out += `${text.slice(last, l.start)}${l.embed ? '!' : ''}[[${target}${suffix}]]`;
    last = l.end;
  }
  return out + text.slice(last);
}

/**
 * A note's name as shown in lists and links: `Mother_Tibia.md` → `Mother Tibia`. The file keeps
 * its name; only the display reads better.
 */
export function prettyName(path: string): string {
  return noteName(path)
    .replace(/\.base$/i, '')
    .replace(/_+/g, ' ')
    .trim();
}
