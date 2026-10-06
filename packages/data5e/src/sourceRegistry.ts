/**
 * Reads 5etools' source tables (full names, abbreviations, dates) out of `js/parser.js` without
 * executing it. Only simple assignment statements are understood:
 *
 *   Parser.SRC_EET = "EET";
 *   Parser.SRC_PSA = `${Parser.SRC_PS_PREFIX}A`;
 *   Parser.SOURCE_JSON_TO_FULL[Parser.SRC_EET] = "Elemental Evil: Trinkets";
 *   Parser.SOURCE_JSON_TO_DATE[Parser.SRC_DrDe_BD] = Parser.SOURCE_JSON_TO_DATE[Parser.SRC_DrDe];
 *
 * Anything else is ignored, so a change in that file degrades to "unknown source", never a crash.
 */

export interface RegistryEntry {
  full?: string;
  abbreviation?: string;
  date?: string;
}

const MAPS = {
  SOURCE_JSON_TO_FULL: 'full',
  SOURCE_JSON_TO_ABV: 'abbreviation',
  SOURCE_JSON_TO_DATE: 'date',
} as const;

interface Env {
  scalars: Map<string, string>;
  maps: Map<string, Map<string, string>>;
}

const STATEMENT =
  /^Parser\.([A-Za-z0-9_]+)(?:\[Parser\.([A-Za-z0-9_]+)\])?\s*=\s*(.+?);\s*(?:\/\/.*)?$/;

/** Evaluates a string expression; returns undefined when it uses anything unsupported. */
function evaluate(expr: string, env: Env): string | undefined {
  const parts = splitConcat(expr.trim());
  if (!parts) return undefined;
  let out = '';
  for (const part of parts) {
    const value = evaluateTerm(part.trim(), env);
    if (value === undefined) return undefined;
    out += value;
  }
  return out;
}

function evaluateTerm(term: string, env: Env): string | undefined {
  const quoted = /^(["'])((?:\\.|(?!\1).)*)\1$/.exec(term);
  if (quoted) return unescape(quoted[2] ?? '');
  const template = /^`([^`]*)`$/.exec(term);
  if (template) {
    const body = template[1] ?? '';
    let out = '';
    let last = 0;
    for (const match of body.matchAll(/\$\{([^}]+)\}/g)) {
      const value = evaluate(match[1] ?? '', env);
      if (value === undefined) return undefined;
      out += body.slice(last, match.index) + value;
      last = match.index + match[0].length;
    }
    return unescape(out + body.slice(last));
  }
  const mapRef = /^Parser\.([A-Za-z0-9_]+)\[Parser\.([A-Za-z0-9_]+)\]$/.exec(term);
  if (mapRef?.[1] && mapRef[2]) {
    const key = env.scalars.get(mapRef[2]);
    return key === undefined ? undefined : env.maps.get(mapRef[1])?.get(key);
  }
  const ref = /^Parser\.([A-Za-z0-9_]+)$/.exec(term);
  if (ref?.[1]) return env.scalars.get(ref[1]);
  return undefined;
}

/** Splits `a + b + c` at top-level plus signs (outside quotes, templates and brackets). */
function splitConcat(expr: string): string[] | null {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '[' || ch === '(' || ch === '{') depth++;
    else if (ch === ']' || ch === ')' || ch === '}') depth--;
    else if (ch === '+' && depth === 0) {
      parts.push(expr.slice(start, i));
      start = i + 1;
    }
  }
  if (quote) return null;
  parts.push(expr.slice(start));
  return parts;
}

function unescape(s: string): string {
  return s.replace(/\\(.)/g, '$1');
}

export function parseSourceRegistry(parserJs: string): Map<string, RegistryEntry> {
  const env: Env = { scalars: new Map(), maps: new Map() };
  for (const line of parserJs.split('\n')) {
    const match = STATEMENT.exec(line.trim());
    if (!match?.[1] || !match[3]) continue;
    const [, target, keyRef, expr] = match;
    const value = evaluate(expr, env);
    if (value === undefined) continue;
    if (keyRef === undefined) {
      env.scalars.set(target, value);
      continue;
    }
    const key = env.scalars.get(keyRef);
    if (key === undefined) continue;
    let map = env.maps.get(target);
    if (!map) {
      map = new Map();
      env.maps.set(target, map);
    }
    map.set(key, value);
  }

  const registry = new Map<string, RegistryEntry>();
  for (const [mapName, field] of Object.entries(MAPS)) {
    for (const [source, value] of env.maps.get(mapName) ?? []) {
      const entry = registry.get(source) ?? {};
      entry[field] = value;
      registry.set(source, entry);
    }
  }
  return registry;
}
