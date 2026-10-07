/**
 * The expression language of Obsidian Bases filters, e.g. `type == "npc"`,
 * `file.hasTag("villain") && !file.inFolder("Archive")`, `location.contains(this)`.
 * A small recursive-descent parser and an evaluator over note values.
 */

export type Expr =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'list'; items: Expr[] }
  | { kind: 'ident'; name: string }
  | { kind: 'member'; object: Expr; name: string }
  | { kind: 'index'; object: Expr; index: Expr }
  | { kind: 'call'; callee: Expr; args: Expr[] }
  | { kind: 'unary'; op: '!' | '-'; arg: Expr }
  | { kind: 'binary'; op: string; left: Expr; right: Expr };

type Token =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string };

const OPS = ['==', '!=', '>=', '<=', '&&', '||', '>', '<', '=', '!', '+', '-', '*', '/', '%'];
const PUNCT = '().,[]';

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src.charAt(i);
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      let s = '';
      i++;
      while (i < src.length && src.charAt(i) !== c) {
        if (src.charAt(i) === '\\' && i + 1 < src.length) i++;
        s += src.charAt(i);
        i++;
      }
      if (i >= src.length) throw new Error('A quote is not closed');
      i++;
      out.push({ t: 'str', v: s });
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^[\p{L}_$][\p{L}\p{N}_$-]*/u.exec(src.slice(i));
    if (id) {
      // `a-b` is a property name (Obsidian allows dashes); `a - b` is a subtraction.
      out.push({ t: 'id', v: id[0] });
      i += id[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      out.push({ t: 'op', v: op });
      i += op.length;
      continue;
    }
    if (PUNCT.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    throw new Error(`Unexpected “${c}”`);
  }
  return out;
}

export function parseExpr(src: string): Expr {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => {
    const t = peek();
    return t?.t === 'op' && t.v === v;
  };
  const expect = (v: string) => {
    if (!isOp(v)) throw new Error(`Expected “${v}”`);
    pos++;
  };

  const binary = (next: () => Expr, ops: string[]) => (): Expr => {
    let left = next();
    for (;;) {
      const t = peek();
      if (t?.t !== 'op' || !ops.includes(t.v)) return left;
      pos++;
      left = { kind: 'binary', op: t.v === '=' ? '==' : t.v, left, right: next() };
    }
  };

  const primary = (): Expr => {
    const t = peek();
    if (!t) throw new Error('The expression ends too early');
    pos++;
    if (t.t === 'num') return { kind: 'literal', value: t.v };
    if (t.t === 'str') return { kind: 'literal', value: t.v };
    if (t.t === 'id') {
      if (t.v === 'true' || t.v === 'false') return { kind: 'literal', value: t.v === 'true' };
      if (t.v === 'null') return { kind: 'literal', value: null };
      return { kind: 'ident', name: t.v };
    }
    if (t.v === '(') {
      const e = expr();
      expect(')');
      return e;
    }
    if (t.v === '[') {
      const items: Expr[] = [];
      if (!isOp(']')) {
        do items.push(expr());
        while (isOp(',') && pos++);
      }
      expect(']');
      return { kind: 'list', items };
    }
    throw new Error(`Unexpected “${t.v}”`);
  };

  const postfix = (): Expr => {
    let e = primary();
    for (;;) {
      if (isOp('.')) {
        pos++;
        const name = peek();
        if (name?.t !== 'id') throw new Error('Expected a name after “.”');
        pos++;
        e = { kind: 'member', object: e, name: name.v };
      } else if (isOp('(')) {
        pos++;
        const args: Expr[] = [];
        if (!isOp(')')) {
          do args.push(expr());
          while (isOp(',') && pos++);
        }
        expect(')');
        e = { kind: 'call', callee: e, args };
      } else if (isOp('[')) {
        pos++;
        const index = expr();
        expect(']');
        e = { kind: 'index', object: e, index };
      } else return e;
    }
  };

  const unary = (): Expr => {
    if (isOp('!') || isOp('-')) {
      const op = (peek() as { v: '!' | '-' }).v;
      pos++;
      return { kind: 'unary', op, arg: unary() };
    }
    return postfix();
  };

  const mul = binary(unary, ['*', '/', '%']);
  const add = binary(mul, ['+', '-']);
  const cmp = binary(add, ['==', '!=', '=', '>', '<', '>=', '<=']);
  const and = binary(cmp, ['&&']);
  const expr = binary(and, ['||']);

  const result = expr();
  if (pos < tokens.length) throw new Error(`Unexpected “${String(peek()?.v)}”`);
  return result;
}

// ---------------------------------------------------------------------------------------------
// Values and evaluation

/** A link to a note: `[[Rustcrown]]` in a property. */
export interface LinkValue {
  link: string;
  display?: string;
}

/** A note as a value: `file`, `this`. */
export interface FileValue {
  file: NoteInfo;
}

export type Value =
  string | number | boolean | null | Value[] | LinkValue | FileValue | { [key: string]: Value };

/** What a filter knows about a note. */
export interface NoteInfo {
  path: string;
  /** Frontmatter. */
  properties: Record<string, unknown>;
  tags: readonly string[];
  /** Targets of the note's links (body and properties). */
  links: readonly string[];
}

export interface EvalContext {
  note: NoteInfo;
  /** The note a base is embedded in (`this`); without one, `this` is null. */
  self?: NoteInfo | undefined;
  /** Where a link target leads, or null. */
  resolve: (target: string, from: string) => string | null;
}

export const isLink = (v: unknown): v is LinkValue =>
  typeof v === 'object' && v !== null && 'link' in v;
export const isFile = (v: unknown): v is FileValue =>
  typeof v === 'object' && v !== null && 'file' in v;

const LINK = /^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]$/;

/** A property value as filters see it: `"[[X]]"` strings become links. */
export function toValue(raw: unknown): Value {
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) return raw.map(toValue);
  if (typeof raw === 'string') {
    const m = LINK.exec(raw.trim());
    if (m)
      return m[2] ? { link: (m[1] ?? '').trim(), display: m[2] } : { link: (m[1] ?? '').trim() };
    return raw;
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') return raw;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === 'object') {
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, toValue(v)]));
  }
  return null;
}

/** A property of a note: exact name first, then ignoring case (bases often differ in case). */
export function propertyOf(note: NoteInfo, name: string): Value {
  if (name in note.properties) return toValue(note.properties[name]);
  const lower = name.toLowerCase();
  const key = Object.keys(note.properties).find((k) => k.toLowerCase() === lower);
  return key === undefined ? null : toValue(note.properties[key]);
}

export const fileName = (path: string) =>
  path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
const folderOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const loose = (s: string) =>
  s
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim();

/** Whether a value refers to a note: a link to it, or its name or title as text. */
function refersTo(v: Value, file: NoteInfo, ctx: EvalContext): boolean {
  if (Array.isArray(v)) return v.some((x) => refersTo(x, file, ctx));
  if (isFile(v)) return v.file.path === file.path;
  if (isLink(v)) return ctx.resolve(v.link, ctx.note.path) === file.path;
  if (typeof v === 'string') {
    const title = file.properties.title;
    return (
      loose(v) === loose(fileName(file.path)) ||
      (typeof title === 'string' && loose(v) === loose(title))
    );
  }
  return false;
}

/** Text shown for a value. */
export function valueText(v: Value): string {
  if (v === null) return '';
  if (Array.isArray(v)) return v.map(valueText).join(', ');
  if (isLink(v)) return v.display ?? v.link;
  if (isFile(v)) return fileName(v.file.path);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function equals(a: Value, b: Value, ctx: EvalContext): boolean {
  if (isFile(a)) return refersTo(b, a.file, ctx);
  if (isFile(b)) return refersTo(a, b.file, ctx);
  if (isLink(a) || isLink(b)) {
    const target = (x: Value) =>
      isLink(x) ? (ctx.resolve(x.link, ctx.note.path) ?? loose(x.link)) : null;
    const ta = target(a);
    const tb = target(b);
    if (ta !== null && tb !== null) return ta === tb;
    const text = isLink(a) ? b : a;
    const link = (isLink(a) ? a : b) as LinkValue;
    return typeof text === 'string' && loose(text) === loose(link.link);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((x, i) => equals(x, b[i] ?? null, ctx))
    );
  }
  if (typeof a === 'number' && typeof b === 'string') return b.trim() !== '' && a === Number(b);
  if (typeof b === 'number' && typeof a === 'string') return a.trim() !== '' && b === Number(a);
  return a === b;
}

/** Sort order: numbers by value, text naturally, empty values last. */
export function compareValues(a: Value, b: Value): number {
  const empty = (v: Value) => v === null || v === '' || (Array.isArray(v) && v.length === 0);
  if (empty(a) || empty(b)) return Number(empty(a)) - Number(empty(b));
  const na = typeof a === 'number' ? a : typeof a === 'string' ? Number(a) : NaN;
  const nb = typeof b === 'number' ? b : typeof b === 'string' ? Number(b) : NaN;
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return valueText(a).localeCompare(valueText(b), 'en', { numeric: true, sensitivity: 'base' });
}

export function truthy(v: Value): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return v !== null && v !== false && v !== 0 && v !== '';
}

const fileValue = (note: NoteInfo): FileValue => ({ file: note });

function fileMember(note: NoteInfo, name: string): Value {
  switch (name) {
    case 'name':
    case 'basename':
      return fileName(note.path);
    case 'path':
      return note.path;
    case 'folder':
      return folderOf(note.path);
    case 'ext':
      return note.path.slice(note.path.lastIndexOf('.') + 1);
    case 'tags':
      return [...note.tags];
    case 'links':
      return note.links.map((l) => ({ link: l }));
    case 'properties':
      return toValue(note.properties);
    case 'file':
      return fileValue(note);
    default:
      return null;
  }
}

function member(object: Value, name: string): Value {
  if (isFile(object)) return fileMember(object.file, name);
  if (name === 'length') {
    if (Array.isArray(object)) return object.length;
    if (typeof object === 'string') return object.length;
  }
  if (typeof object === 'object' && object !== null && !Array.isArray(object) && !isLink(object)) {
    return (object as Record<string, Value>)[name] ?? null;
  }
  return null;
}

function contains(haystack: Value, needle: Value, ctx: EvalContext): boolean {
  if (Array.isArray(haystack)) return haystack.some((x) => equals(x, needle, ctx));
  if (isFile(needle)) return refersTo(haystack, needle.file, ctx);
  if (isLink(haystack)) return equals(haystack, needle, ctx);
  if (typeof haystack === 'string' && typeof needle === 'string') {
    return haystack.toLowerCase().includes(needle.toLowerCase());
  }
  return haystack !== null && equals(haystack, needle, ctx);
}

function callMethod(object: Value, name: string, args: Value[], ctx: EvalContext): Value {
  const arg = args[0] ?? null;
  if (isFile(object)) {
    const note = object.file;
    const norm = (t: Value) => valueText(t).replace(/^#/, '').toLowerCase();
    switch (name) {
      case 'hasTag':
        return args.some((t) => {
          const want = norm(t);
          return note.tags.some((x) => {
            const tag = x.toLowerCase();
            return tag === want || tag.startsWith(`${want}/`);
          });
        });
      case 'inFolder': {
        const want = valueText(arg).replace(/\/+$/, '').toLowerCase();
        const folder = folderOf(note.path).toLowerCase();
        return folder === want || folder.startsWith(`${want}/`);
      }
      case 'hasProperty':
        return propertyOf(note, valueText(arg)) !== null;
      case 'hasLink':
        return note.links.some((l) => {
          const path = ctx.resolve(l, note.path);
          return isFile(arg) ? path === arg.file.path : loose(l) === loose(valueText(arg));
        });
      default:
        return null;
    }
  }
  switch (name) {
    case 'contains':
      return contains(object, arg, ctx);
    case 'containsAny':
      return args.some((a) => contains(object, a, ctx));
    case 'containsAll':
      return args.every((a) => contains(object, a, ctx));
    case 'startsWith':
      return valueText(object).toLowerCase().startsWith(valueText(arg).toLowerCase());
    case 'endsWith':
      return valueText(object).toLowerCase().endsWith(valueText(arg).toLowerCase());
    case 'isEmpty':
      return !truthy(object) && object !== 0 && object !== false;
    case 'lower':
      return valueText(object).toLowerCase();
    case 'upper':
      return valueText(object).toUpperCase();
    case 'trim':
      return valueText(object).trim();
    case 'toString':
      return valueText(object);
    case 'join':
      return Array.isArray(object)
        ? object.map(valueText).join(arg === null ? ', ' : valueText(arg))
        : valueText(object);
    default:
      throw new Error(`Unknown function “${name}”`);
  }
}

function callGlobal(name: string, args: Value[]): Value {
  const arg = args[0] ?? null;
  switch (name) {
    case 'link':
      return { link: valueText(arg) };
    case 'list':
      return Array.isArray(arg) ? arg : arg === null ? [] : [arg];
    case 'number': {
      const n = Number(valueText(arg));
      return Number.isFinite(n) ? n : null;
    }
    case 'if':
      return truthy(arg) ? (args[1] ?? null) : (args[2] ?? null);
    case 'today':
      return new Date().toISOString().slice(0, 10);
    default:
      throw new Error(`Unknown function “${name}”`);
  }
}

export function evaluate(e: Expr, ctx: EvalContext): Value {
  switch (e.kind) {
    case 'literal':
      return e.value;
    case 'list':
      return e.items.map((i) => evaluate(i, ctx));
    case 'ident':
      if (e.name === 'file') return fileValue(ctx.note);
      if (e.name === 'this') return ctx.self ? fileValue(ctx.self) : null;
      if (e.name === 'note') return toValue(ctx.note.properties);
      return propertyOf(ctx.note, e.name);
    case 'member': {
      // `note.role` and `note["role"]` read properties ignoring case, like bare names.
      if (e.object.kind === 'ident' && e.object.name === 'note')
        return propertyOf(ctx.note, e.name);
      return member(evaluate(e.object, ctx), e.name);
    }
    case 'index': {
      const object = evaluate(e.object, ctx);
      const index = evaluate(e.index, ctx);
      if (Array.isArray(object) && typeof index === 'number') return object[index] ?? null;
      return member(object, valueText(index));
    }
    case 'call': {
      const args = e.args.map((a) => evaluate(a, ctx));
      if (e.callee.kind === 'ident') return callGlobal(e.callee.name, args);
      if (e.callee.kind === 'member') {
        return callMethod(evaluate(e.callee.object, ctx), e.callee.name, args, ctx);
      }
      throw new Error('This cannot be called');
    }
    case 'unary': {
      const v = evaluate(e.arg, ctx);
      return e.op === '!' ? !truthy(v) : typeof v === 'number' ? -v : null;
    }
    case 'binary': {
      if (e.op === '&&') return truthy(evaluate(e.left, ctx)) && truthy(evaluate(e.right, ctx));
      if (e.op === '||') return truthy(evaluate(e.left, ctx)) || truthy(evaluate(e.right, ctx));
      const a = evaluate(e.left, ctx);
      const b = evaluate(e.right, ctx);
      switch (e.op) {
        case '==':
          return equals(a, b, ctx);
        case '!=':
          return !equals(a, b, ctx);
        case '>':
          return a !== null && b !== null && compareValues(a, b) > 0;
        case '<':
          return a !== null && b !== null && compareValues(a, b) < 0;
        case '>=':
          return a !== null && b !== null && compareValues(a, b) >= 0;
        case '<=':
          return a !== null && b !== null && compareValues(a, b) <= 0;
        case '+':
          return typeof a === 'number' && typeof b === 'number'
            ? a + b
            : valueText(a) + valueText(b);
        default: {
          const x = typeof a === 'number' ? a : Number(valueText(a));
          const y = typeof b === 'number' ? b : Number(valueText(b));
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
          if (e.op === '-') return x - y;
          if (e.op === '*') return x * y;
          if (e.op === '/') return y === 0 ? null : x / y;
          return y === 0 ? null : x % y;
        }
      }
    }
  }
}
