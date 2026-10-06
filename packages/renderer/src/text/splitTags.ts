/**
 * 5etools rich text: plain text with `{@tag args}` markers that can nest, e.g.
 * `{@b Hit:} {@damage 2d6 + 3} slashing damage, see {@spell fireball|xphb|this spell}`.
 */

export type Segment = { kind: 'text'; text: string } | { kind: 'tag'; name: string; body: string };

/** Splits a string into text and top-level tags. Unbalanced braces fall back to text. */
export function splitTags(input: string): Segment[] {
  const out: Segment[] = [];
  let text = '';
  let i = 0;
  while (i < input.length) {
    if (input.startsWith('{@', i)) {
      const end = matchingBrace(input, i);
      if (end !== -1) {
        if (text) {
          out.push({ kind: 'text', text });
          text = '';
        }
        const inner = input.slice(i + 2, end);
        const space = inner.search(/\s/);
        const name = space === -1 ? inner : inner.slice(0, space);
        const body = space === -1 ? '' : inner.slice(space + 1);
        out.push({ kind: 'tag', name, body });
        i = end + 1;
        continue;
      }
    }
    text += input.charAt(i);
    i++;
  }
  if (text) out.push({ kind: 'text', text });
  return out;
}

/** Index of the `}` closing the `{` at `start`, honouring nesting; -1 if unbalanced. */
function matchingBrace(input: string, start: number): number {
  let depth = 0;
  for (let i = start; i < input.length; i++) {
    const ch = input.charAt(i);
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Splits a tag body on `|`, ignoring pipes inside nested tags. Parts are trimmed. */
export function splitArgs(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (ch === '|' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += ch;
  }
  parts.push(current.trim());
  return parts;
}

/** Plain text of rich text: tags replaced by their display text (for titles, search, aria). */
export function stripTags(input: string): string {
  return splitTags(input)
    .map((s) => {
      if (s.kind === 'text') return s.text;
      const args = splitArgs(s.body);
      // Most tags display their first argument; links may override it with a display arg.
      return stripTags(args[0] ?? '');
    })
    .join('');
}
