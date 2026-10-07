import {
  emptyExtraction,
  isObj,
  num,
  refKey,
  type Branch,
  type Extraction,
  type Issues,
} from '../model';

/**
 * Feats an entity gives: `feats: [{ "skilled|xphb": true }]`, `[{ "any": 1 }]` or
 * `[{ "anyFromCategory": { "category": ["O"], "count": 1 } }]`. Several entries are alternatives.
 */

const CATEGORY_NAMES: Record<string, string> = {
  G: 'General',
  O: 'Origin',
  FS: 'Fighting Style',
  'FS:P': 'Fighting Style',
  'FS:R': 'Fighting Style',
  EB: 'Epic Boon',
  D: 'Dragonmark',
  DG: 'Dark Gift',
};

/** "Choose a General feat", "Choose 2 Origin feats". */
function featLabel(count: number, categories: readonly string[]): string {
  const names = [...new Set(categories.map((c) => CATEGORY_NAMES[c] ?? c))];
  const kind = names.length === 1 ? `${names[0] ?? ''} ` : '';
  return count === 1
    ? `Choose ${/^[AEIOU]/.test(kind) ? 'an' : 'a'} ${kind}feat`
    : `Choose ${String(count)} ${kind}feats`;
}

function readAlternative(alt: Record<string, unknown>, id: string, issues: Issues): Extraction {
  const out = emptyExtraction();
  for (const [key, value] of Object.entries(alt)) {
    if (value === true) {
      // `magic initiate; cleric|xphb`: a version of Magic Initiate.
      const [name = '', source] = key.split('|');
      const semi = name.indexOf('; ');
      if (semi > 0) {
        const base = name.slice(0, semi);
        out.grants.push({
          kind: 'feat',
          key: refKey('feat', source === undefined ? base : `${base}|${source}`),
          version: name,
        });
      } else out.grants.push({ kind: 'feat', key: refKey('feat', key) });
    } else if (key === 'any' && typeof value === 'number') {
      out.choices.push({
        id,
        kind: 'feat',
        count: value,
        label: value === 1 ? 'Choose a feat' : `Choose ${String(value)} feats`,
        filter: { type: 'feat' },
      });
    } else if (key === 'anyFromCategory' && isObj(value)) {
      const categories = (Array.isArray(value.category) ? value.category : [value.category]).filter(
        (c): c is string => typeof c === 'string',
      );
      const count = num(value.count) ?? 1;
      out.choices.push({
        id,
        kind: 'feat',
        count,
        label: featLabel(count, categories),
        filter: { type: 'feat', categories },
      });
    } else issues.add(id, `unknown feat entry ${key}=${JSON.stringify(value)}`);
  }
  return out;
}

export function readFeats(value: unknown, id: string, issues: Issues): Extraction {
  const alts = (Array.isArray(value) ? value : [value]).filter(isObj);
  if (alts.length === 1 && alts[0]) return readAlternative(alts[0], id, issues);
  const branches: Branch[] = alts.map((alt, i) => {
    const ex = readAlternative(alt, `${id}/${String(i)}`, issues);
    return { id: String(i), label: `Option ${String(i + 1)}`, ...ex };
  });
  return {
    grants: [],
    choices: [
      {
        id,
        kind: 'alternative',
        count: 1,
        label: 'Choose a feat option',
        options: branches.map((b) => b.id),
        branches,
      },
    ],
  };
}
