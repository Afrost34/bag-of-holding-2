import { isAttachment, parseCompendiumRef, resolveLinkPath } from './links';
import { parseWikiLinks } from './syntax';

/**
 * One-time import of an Obsidian vault into a campaign's journal: which files come along, the
 * small rewrites notes need, and a report of links that lead nowhere.
 */

/** Files a journal can show: notes, bases, images, PDFs and sounds. */
const KEPT = /\.(md|base|png|jpe?g|gif|webp|svg|bmp|avif|pdf|mp3|wav|ogg|mp4|webm)$/i;

export interface ImportPlan {
  /** Paths inside the vault (the picked folder's own name removed), to import. */
  files: string[];
  /** Left out: scripts and other files a journal cannot show. */
  skipped: string[];
  /** Also left out: files in hidden folders (Obsidian's settings, its trash, Git history). */
  hidden: number;
}

/** What to import from a picked folder's files (`Vault/Notes/A.md`…). */
export function planImport(paths: readonly string[]): ImportPlan {
  const files: string[] = [];
  const skipped: string[] = [];
  let hidden = 0;
  for (const full of paths) {
    const path = full.replace(/\\/g, '/').split('/').slice(1).join('/');
    if (!path) continue;
    if (path.split('/').some((part) => part.startsWith('.'))) hidden++;
    else if (KEPT.test(path)) files.push(path);
    else skipped.push(path);
  }
  return { files: files.sort(), skipped: skipped.sort(), hidden };
}

/** The previous Bag of Holding's links: `[[App:Spell:Shield]]`, `[[App:Spell:id:spell_fireball_phb]]`. */
const OLD_APP_LINK = /\[\[App:([A-Za-z]+):((?:id:)?[^\]|]+)(\|[^\]]*)?\]\]/g;

/** Rewrites what Obsidian notes need for the journal (old app links become compendium links). */
export function convertNote(text: string): string {
  return text.replace(OLD_APP_LINK, (whole, type: string, ref: string, display = '') => {
    const kind = type.toLowerCase();
    if (!ref.startsWith('id:')) return `[[${kind}:${ref.trim()}${display}]]`;
    // `id:spell_fireball_phb`: type, name words, source.
    const parts = ref.slice(3).split('_');
    if (parts[0]?.toLowerCase() === kind) parts.shift();
    const source = parts.length > 1 ? parts.pop() : undefined;
    const name = parts.join(' ');
    return name
      ? `[[${kind}:${name}${source ? `@${source.toUpperCase()}` : ''}${display}]]`
      : whole;
  });
}

export interface DeadLink {
  /** The note the link is in. */
  from: string;
  target: string;
  count: number;
}

export interface LinkReport {
  total: number;
  resolved: number;
  dead: DeadLink[];
}

/** Every note and file link in the journal, and those that lead nowhere. */
export function linkReport(
  notes: ReadonlyMap<string, string>,
  attachments: readonly string[],
): LinkReport {
  const notePaths = [...notes.keys()];
  const dead = new Map<string, DeadLink>();
  let total = 0;
  for (const [from, text] of notes) {
    for (const link of parseWikiLinks(text)) {
      if (!link.target || parseCompendiumRef(link.target)) continue;
      total++;
      const pool = isAttachment(link.target) ? attachments : notePaths;
      if (resolveLinkPath(link.target, pool, from) !== null) continue;
      const key = `${from}\n${link.target}`;
      const entry = dead.get(key) ?? { from, target: link.target, count: 0 };
      entry.count++;
      dead.set(key, entry);
    }
  }
  const list = [...dead.values()].sort((a, b) => a.from.localeCompare(b.from));
  return { total, resolved: total - list.reduce((n, d) => n + d.count, 0), dead: list };
}
