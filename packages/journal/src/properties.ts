import { Document, isMap, isScalar, isSeq, parseDocument } from 'yaml';
import { parseFrontmatter } from './syntax';

/**
 * Editing a note's properties (its YAML frontmatter) without disturbing the rest of it: comments,
 * key order and quoting of untouched keys survive, and the body is left exactly as it was.
 */

export type PropertyValue = string | number | boolean | string[] | null;

const BOM = String.fromCharCode(0xfeff);

function split(text: string): { yaml: string | null; body: string; bom: string } {
  const bom = text.startsWith(BOM) ? BOM : '';
  const { bodyStart, error } = parseFrontmatter(text);
  if (bodyStart === 0) return { yaml: null, body: text.slice(bom.length), bom };
  const block = text.slice(bom.length, bodyStart);
  const yaml = block.replace(/^---\r?\n/, '').replace(/\r?\n---[ \t]*(\r?\n)?$/, '');
  // Invalid YAML is left alone rather than overwritten.
  if (error) throw new Error(`The note's properties are not valid YAML: ${error}`);
  return { yaml, body: text.slice(bodyStart), bom };
}

function join(bom: string, yaml: string, body: string): string {
  const inner = yaml.replace(/\n+$/, '');
  if (!inner.trim() || inner.trim() === '{}') return `${bom}${body}`;
  return `${bom}---\n${inner}\n---\n${body}`;
}

function edit(text: string, change: (doc: Document) => void): string {
  const { yaml, body, bom } = split(text);
  const parsed = parseDocument(yaml ?? '');
  let doc: Document;
  if (isMap(parsed.contents)) doc = parsed;
  else if (parsed.contents === null) doc = new Document({});
  else throw new Error("The note's properties are not a list of names and values.");
  change(doc);
  return join(bom, doc.toString({ lineWidth: 0 }), body);
}

/** Sets a property, adding the frontmatter if the note has none. */
export function setProperty(text: string, key: string, value: PropertyValue): string {
  return edit(text, (doc) => {
    const node = doc.createNode(value);
    if (isSeq(node)) node.flow = false;
    doc.set(key, node);
  });
}

export function removeProperty(text: string, key: string): string {
  return edit(text, (doc) => {
    doc.delete(key);
  });
}

/** Renames a property in place, keeping its value and position. */
export function renameProperty(text: string, from: string, to: string): string {
  if (from === to) return text;
  return edit(text, (doc) => {
    const map = doc.contents;
    if (!isMap(map)) return;
    const pair = map.items.find((p) => isScalar(p.key) && String(p.key.value) === from);
    if (pair && isScalar(pair.key)) pair.key.value = to;
  });
}

/** How a property is edited: a checkbox, a list of chips, a number field or text. */
export function propertyKind(value: unknown): 'boolean' | 'list' | 'number' | 'text' {
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'list';
  if (typeof value === 'number') return 'number';
  return 'text';
}

/** An image named in a note's properties (`banner`, `image` or `cover`): a URL or a file link. */
export function bannerOf(
  data: Record<string, unknown>,
): { kind: 'url' | 'file'; target: string } | null {
  const raw = data.banner ?? data.image ?? data.cover;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const value = raw.trim();
  if (/^https?:\/\//i.test(value)) return { kind: 'url', target: value };
  const inner = /^!?\[\[([^\]]+)\]\]$/.exec(value)?.[1] ?? value;
  const target = inner.split('|')[0]?.trim() ?? '';
  return target ? { kind: 'file', target } : null;
}
