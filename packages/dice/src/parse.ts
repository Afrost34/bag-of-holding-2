import type { Expression, KeepMode, Node, Prompt } from './ast';

/**
 * Parses the dice notation used across 5etools data and the dice tray:
 *
 *   1d20 + 5        d20        D6         4d10 + 6       1d4 - 1
 *   3d6 × 100       2d4 × 1,000           (1d6 + 6) × 10
 *   1d8 + 3 + summonSpellLevel            (summonSpellLevel - 4)d4 + 3
 *   ceil(#$prompt_number:title=Enter a Size$# / 5)        4d6kh3    2d20kl1
 *
 * Multiplication accepts `*`, `×` and a standalone `x`. Numbers may use thousands separators.
 * A `;` separates alternative expressions (`d6;d8`), see `parseAlternatives`.
 */

export class DiceSyntaxError extends Error {
  constructor(
    message: string,
    readonly source: string,
    readonly position: number,
  ) {
    super(`${message} in "${source}" at ${String(position)}`);
    this.name = 'DiceSyntaxError';
  }
}

type Token =
  | { t: 'num'; v: number; pos: number }
  | { t: 'op'; v: '+' | '-' | '*' | '/'; pos: number }
  | { t: 'd'; pos: number }
  | { t: 'keep'; mode: KeepMode; count: number; pos: number }
  | { t: '('; pos: number }
  | { t: ')'; pos: number }
  | { t: 'ident'; v: string; pos: number }
  | { t: 'prompt'; prompt: Prompt; pos: number }
  | { t: 'percent'; pos: number };

const FUNCTIONS = new Set(['ceil', 'floor', 'round']);

function parsePrompt(body: string): Prompt {
  // prompt_number:title=Enter a Modifier,default=0,min=0,max=5
  const params = body.replace(/^prompt_number:?/, '');
  const prompt: Prompt = { title: 'Enter a number' };
  for (const part of params.split(',')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 'title') prompt.title = value;
    else if (key === 'default' || key === 'min' || key === 'max') {
      const n = Number(value);
      if (Number.isFinite(n)) prompt[key] = n;
    }
  }
  return prompt;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const prev = () => tokens.at(-1);
  const endsOperand = () => {
    const p = prev();
    return (
      p !== undefined &&
      (p.t === 'num' ||
        p.t === ')' ||
        p.t === 'ident' ||
        p.t === 'prompt' ||
        p.t === 'keep' ||
        p.t === 'percent')
    );
  };

  while (i < src.length) {
    const ch = src.charAt(i);
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (src.startsWith('#$', i)) {
      const end = src.indexOf('$#', i + 2);
      if (end < 0) throw new DiceSyntaxError('Unclosed prompt', src, i);
      tokens.push({ t: 'prompt', prompt: parsePrompt(src.slice(i + 2, end)), pos: i });
      i = end + 2;
      continue;
    }
    // Thousands separators only between digit groups: 1,000 or 10,000.
    const num = /^\d{1,3}(?:,\d{3})+(?!\d)|^\d+(?:\.\d+)?/.exec(src.slice(i));
    if (num) {
      tokens.push({ t: 'num', v: Number(num[0].replaceAll(',', '')), pos: i });
      i += num[0].length;
      continue;
    }
    if ((ch === 'd' || ch === 'D') && /^[0-9%(]/.test(src.charAt(i + 1))) {
      tokens.push({ t: 'd', pos: i });
      i++;
      if (src.charAt(i) === '%') {
        tokens.push({ t: 'percent', pos: i });
        i++;
      }
      continue;
    }
    const keep = /^(kh|kl|dh|dl)(\d*)/.exec(src.slice(i));
    if (keep && endsOperand()) {
      tokens.push({
        t: 'keep',
        mode: keep[1] as KeepMode,
        count: keep[2] ? Number(keep[2]) : 1,
        pos: i,
      });
      i += keep[0].length;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '/') {
      tokens.push({ t: 'op', v: ch, pos: i });
      i++;
      continue;
    }
    if (ch === '−' || ch === '–') {
      // Unicode minus / en dash, as printed in some books.
      tokens.push({ t: 'op', v: '-', pos: i });
      i++;
      continue;
    }
    if (ch === '*' || ch === '×') {
      tokens.push({ t: 'op', v: '*', pos: i });
      i++;
      continue;
    }
    if ((ch === 'x' || ch === 'X') && endsOperand() && !/[A-Za-z_]/.test(src.charAt(i + 1))) {
      tokens.push({ t: 'op', v: '*', pos: i });
      i++;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ t: ch, pos: i });
      i++;
      continue;
    }
    const ident = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (ident) {
      tokens.push({ t: 'ident', v: ident[0], pos: i });
      i += ident[0].length;
      continue;
    }
    throw new DiceSyntaxError(`Unexpected "${ch}"`, src, i);
  }
  return tokens;
}

class Parser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly src: string,
  ) {}

  parse(): Node {
    const node = this.expr();
    const extra = this.peek();
    if (extra) throw new DiceSyntaxError('Unexpected token', this.src, extra.pos);
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  private fail(message: string): never {
    throw new DiceSyntaxError(message, this.src, this.peek()?.pos ?? this.src.length);
  }

  // expr := term (('+' | '-') term)*
  private expr(): Node {
    let left = this.term();
    for (let t = this.peek(); t?.t === 'op' && (t.v === '+' || t.v === '-'); t = this.peek()) {
      this.next();
      left = { kind: 'binary', op: t.v, left, right: this.term() };
    }
    return left;
  }

  // term := unary (('*' | '/') unary)*
  private term(): Node {
    let left = this.unary();
    for (let t = this.peek(); t?.t === 'op' && (t.v === '*' || t.v === '/'); t = this.peek()) {
      this.next();
      left = { kind: 'binary', op: t.v, left, right: this.unary() };
    }
    return left;
  }

  // unary := ('-' | '+') unary | dice
  private unary(): Node {
    const t = this.peek();
    if (t?.t === 'op' && t.v === '-') {
      this.next();
      return { kind: 'negate', operand: this.unary() };
    }
    if (t?.t === 'op' && t.v === '+') {
      this.next();
      return this.unary();
    }
    return this.dice();
  }

  // dice := 'd' sides | atom ('d' sides)? keep?
  private dice(): Node {
    let node: Node;
    if (this.peek()?.t === 'd') {
      node = this.diceTail({ kind: 'number', value: 1 });
    } else {
      node = this.atom();
      if (this.peek()?.t === 'd') node = this.diceTail(node);
    }
    return node;
  }

  private diceTail(count: Node): Node {
    this.next(); // 'd'
    let faces: Node;
    if (this.peek()?.t === 'percent') {
      this.next();
      faces = { kind: 'number', value: 100 };
    } else {
      faces = this.atom();
    }
    const node: Node = { kind: 'dice', count, faces };
    const keep = this.peek();
    if (keep?.t === 'keep') {
      this.next();
      node.keep = { mode: keep.mode, count: keep.count };
    }
    return node;
  }

  // atom := number | '(' expr ')' | fn '(' expr ')' | variable | prompt
  private atom(): Node {
    const t = this.next();
    if (!t) return this.fail('Expected a value');
    switch (t.t) {
      case 'num':
        return { kind: 'number', value: t.v };
      case 'prompt':
        return { kind: 'prompt', prompt: t.prompt };
      case '(': {
        const inner = this.expr();
        if (this.next()?.t !== ')') this.fail('Expected ")"');
        return inner;
      }
      case 'ident': {
        const name = t.v.toLowerCase();
        if (FUNCTIONS.has(name) && this.peek()?.t === '(') {
          this.next();
          const arg = this.expr();
          if (this.next()?.t !== ')') this.fail('Expected ")"');
          return { kind: 'call', fn: name as 'ceil' | 'floor' | 'round', arg };
        }
        return { kind: 'variable', name: t.v };
      }
      default:
        throw new DiceSyntaxError('Expected a value', this.src, t.pos);
    }
  }
}

export function parse(source: string): Expression {
  const trimmed = source.trim();
  if (trimmed === '') throw new DiceSyntaxError('Empty expression', source, 0);
  return { source: trimmed, root: new Parser(tokenize(trimmed), trimmed).parse() };
}

/** `d6;d8` → two expressions. A plain expression gives a list of one. */
export function parseAlternatives(source: string): Expression[] {
  return source
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parse);
}

/** Parses without throwing; useful for UI validation. */
export function tryParse(source: string): Expression | null {
  try {
    return parse(source);
  } catch {
    return null;
  }
}
