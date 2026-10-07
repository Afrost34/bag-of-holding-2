import { parse as parseYaml } from 'yaml';

/**
 * Obsidian-flavoured Markdown, the parts the app needs to understand: wikilinks, embeds, tags
 * and YAML frontmatter. Everything inside code (fenced blocks and `inline code`) is ignored, as
 * Obsidian does.
 */

export interface WikiLink {
  /** Offsets of the whole `[[...]]` (or `![[...]]`) in the text. */
  start: number;
  end: number;
  /** The note name, path or compendium key: `Waterdeep`, `Places/Waterdeep`, `spell:Fireball@XPHB`. */
  target: string;
  /** `[[Note#Heading]]` */
  heading?: string;
  /** `[[Note#^block-id]]` */
  block?: string;
  /** `[[Note|shown text]]` */
  display?: string;
  /** `![[...]]`: embed the target instead of linking to it. */
  embed: boolean;
}

/** [start, end) ranges of code where nothing is parsed. */
export function codeRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  const fence = /^(\s*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n\1?\2[^\n]*(?:\n|$)|$)/gm;
  for (const m of text.matchAll(fence)) ranges.push([m.index, m.index + m[0].length]);
  const inline = /(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g;
  for (const m of text.matchAll(inline)) {
    if (!ranges.some(([s, e]) => m.index >= s && m.index < e)) {
      ranges.push([m.index, m.index + m[0].length]);
    }
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

function inRanges(pos: number, ranges: readonly [number, number][]): boolean {
  return ranges.some(([s, e]) => pos >= s && pos < e);
}

/** Splits `target#heading^block|display`. `\|` (escaped inside tables) also separates. */
export function parseLinkInner(inner: string): Omit<WikiLink, 'start' | 'end' | 'embed'> {
  const pipe = inner.search(/\\?\|/);
  const main = pipe === -1 ? inner : inner.slice(0, pipe);
  const display = pipe === -1 ? undefined : inner.slice(pipe).replace(/^\\?\|/, '');
  const hash = main.indexOf('#');
  const target = (hash === -1 ? main : main.slice(0, hash)).trim();
  const after = hash === -1 ? '' : main.slice(hash + 1).trim();
  const link: Omit<WikiLink, 'start' | 'end' | 'embed'> = { target };
  if (after.startsWith('^')) link.block = after.slice(1);
  else if (after) link.heading = after;
  if (display !== undefined && display.trim() !== '') link.display = display.trim();
  return link;
}

export function parseWikiLinks(text: string, code = codeRanges(text)): WikiLink[] {
  const links: WikiLink[] = [];
  for (const m of text.matchAll(/(!?)\[\[([^[\]\n]+?)\]\]/g)) {
    if (inRanges(m.index, code)) continue;
    const inner = m[2] ?? '';
    links.push({
      start: m.index,
      end: m.index + m[0].length,
      embed: m[1] === '!',
      ...parseLinkInner(inner),
    });
  }
  return links;
}

/**
 * `#tag`, `#nested/tag`: letters, digits, `_`, `-` and `/`, not only digits, not right after a
 * word character (so URLs and `C#` are not tags).
 */
export function parseTags(text: string, code = codeRanges(text)): string[] {
  const tags = new Set<string>();
  for (const m of text.matchAll(/(^|[^\w&/#])#([\p{L}\p{N}_/-]+)/gu)) {
    const tag = m[2] ?? '';
    const at = m.index + (m[1]?.length ?? 0);
    if (/^\d+$/.test(tag) || inRanges(at, code)) continue;
    tags.add(tag.replace(/\/+$/, ''));
  }
  return [...tags];
}

export interface Frontmatter {
  /** Parsed YAML (an empty object without frontmatter or when it does not parse). */
  data: Record<string, unknown>;
  /** Where the note's body starts (0 without frontmatter). */
  bodyStart: number;
  /** Set when the YAML is invalid; the note still works, its properties are just ignored. */
  error?: string;
}

export function parseFrontmatter(text: string): Frontmatter {
  // Notes saved by some Windows editors start with a byte-order mark before the `---`.
  const bom = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text.slice(bom));
  if (!m) return { data: {}, bodyStart: 0 };
  const bodyStart = bom + m[0].length;
  try {
    const parsed: unknown = parseYaml(m[1] ?? '');
    const data =
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    return { data, bodyStart };
  } catch (error) {
    return {
      data: {},
      bodyStart,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Tags from frontmatter (`tags: [a, b]`, `tags: a, b`, a YAML list) and from the body. */
export function noteTags(text: string): string[] {
  const { data, bodyStart } = parseFrontmatter(text);
  const fm = data.tags ?? data.tag;
  const fromFm = (Array.isArray(fm) ? fm : typeof fm === 'string' ? fm.split(/[,\s]+/) : [])
    .map((t) => String(t).replace(/^#/, '').trim())
    .filter(Boolean);
  return [...new Set([...fromFm, ...parseTags(text.slice(bodyStart))])];
}

/**
 * What a link shows of a note: the body without frontmatter, or with `#Heading` just that section
 * (up to the next heading of the same or a higher level). Null when the heading is not there.
 */
export function noteSection(text: string, heading?: string): string | null {
  const body = text.slice(parseFrontmatter(text).bodyStart);
  if (!heading) return body;
  const lines = body.split('\n');
  const wanted = heading.trim().toLowerCase();
  const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && headingText(l) === wanted);
  if (start === -1) return null;
  const level = headingLevel(lines[start] ?? '');
  const end = lines.findIndex(
    (l, i) => i > start && /^#{1,6}\s/.test(l) && headingLevel(l) <= level,
  );
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

const headingLevel = (line: string) => /^#+/.exec(line)?.[0].length ?? 0;
const headingText = (line: string) =>
  line
    .replace(/^#+\s+/, '')
    .replace(/\s+#+\s*$/, '')
    .trim()
    .toLowerCase();
