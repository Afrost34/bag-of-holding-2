import { prettyName } from './links';
import { noteTags, parseFrontmatter } from './syntax';

export interface NoteHit {
  path: string;
  /** The note's name as shown (its `title`, else its file name without underscores). */
  name: string;
  /** Its kind (`npc`, `location`…) when it has one. */
  type: string | null;
  /** A line around the first match in the text, without Markdown marks. */
  snippet: string;
}

const MARKS = /(\*\*|__|==|~~|`|^#+\s|^>\s?|\[\[([^\]|]*\|)?|\]\]|<[^>]+>)/gm;

/**
 * Journal notes matching a search, best first: names that start with it, then names containing
 * it, then tags and properties, then the text. Every word of the query has to appear.
 */
export function searchNotes(
  notes: ReadonlyMap<string, string>,
  query: string,
  limit = 8,
): NoteHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored: { hit: NoteHit; score: number }[] = [];
  for (const [path, text] of notes) {
    const { data, bodyStart } = parseFrontmatter(text);
    const title =
      typeof data.title === 'string' && data.title.trim() ? data.title.trim() : prettyName(path);
    const name = title.toLowerCase();
    const props = Object.values(data)
      .flat()
      .filter((v) => typeof v === 'string' || typeof v === 'number')
      .join(' ')
      .toLowerCase();
    const tags = noteTags(text).join(' ').toLowerCase();
    const body = text.slice(bodyStart).toLowerCase();
    let score = 0;
    let ok = true;
    for (const w of words) {
      if (name.startsWith(w)) score += 100;
      else if (name.includes(w)) score += 60;
      else if (tags.includes(w)) score += 30;
      else if (props.includes(w)) score += 20;
      else if (body.includes(w)) score += 5;
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const bodyText = text.slice(bodyStart);
    const at = bodyText.toLowerCase().indexOf(words[0] ?? '');
    const lineStart = at === -1 ? 0 : bodyText.lastIndexOf('\n', at) + 1;
    const lineEnd = at === -1 ? -1 : bodyText.indexOf('\n', at);
    const line = (
      at === -1
        ? (bodyText.trim().split('\n')[0] ?? '')
        : bodyText.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
    )
      .replace(MARKS, '')
      .trim();
    scored.push({
      hit: {
        path,
        name: title,
        type: typeof data.type === 'string' ? data.type : null,
        snippet: line.length > 140 ? `${line.slice(0, 140)}…` : line,
      },
      score,
    });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.hit.name.localeCompare(b.hit.name))
    .slice(0, limit)
    .map((s) => s.hit);
}
