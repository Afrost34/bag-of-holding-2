import { isObj } from './json';

/**
 * 5etools property templates: `{=baseName}`, `{=baseName/l}` (lowercase), `{=bonusAc}`… used by
 * generic magic item variants. A port of `Renderer.applyProperties` (js/render.js).
 */

type Obj = Record<string, unknown>;

const LEADING_AN = new Set(['a', 'e', 'i', 'o', 'u']);
const OP_ORDER = ['r', 'f', 'c', 'v', 'x', 'l', 't', 'u', 'a'];
const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
]; // prettier-ignore

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function applyModifiers(value: unknown, modifiers: string): string {
  let out: unknown = value;
  // Modifiers are single ASCII letters.
  const ordered = modifiers.split('').sort((a, b) => OP_ORDER.indexOf(a) - OP_ORDER.indexOf(b));
  for (const m of ordered) {
    const s = typeof out === 'number' ? String(out) : typeof out === 'string' ? out : '';
    switch (m) {
      case 'a':
        out = LEADING_AN.has(s.charAt(0).toLowerCase()) ? 'an' : 'a';
        break;
      case 'l':
        out = s.toLowerCase();
        break;
      case 't':
        out = titleCase(s);
        break;
      case 'u':
        out = s.toUpperCase();
        break;
      case 'x':
        out = NUMBER_WORDS[Number(s)] ?? s;
        break;
      case 'r':
        out = Math.round(Number(s));
        break;
      case 'f':
        out = Math.floor(Number(s));
        break;
      case 'c':
        out = Math.ceil(Number(s));
        break;
      default:
        break;
    }
  }
  return typeof out === 'number' ? String(out) : typeof out === 'string' ? out : '';
}

/** Fills `{=path}` and `{=path/modifiers}` placeholders, inside tags too. */
export function applyProperties(text: string, values: Obj): string {
  if (!text.includes('{=')) return text;
  return text.replace(/\{=([^}/]+)(?:\/([a-z]+))?\}/g, (_m, path: string, mods?: string) => {
    const value = values[path];
    return applyModifiers(value, mods ?? '');
  });
}

export function applyAllProperties(value: unknown, values: Obj): unknown {
  if (typeof value === 'string') return applyProperties(value, values);
  if (Array.isArray(value)) return value.map((v) => applyAllProperties(v, values));
  if (isObj(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, applyAllProperties(v, values)]),
    );
  }
  return value;
}
