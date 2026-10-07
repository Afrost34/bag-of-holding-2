import {
  ABILITIES,
  emptyExtraction,
  isAbility,
  isObj,
  num,
  type Ability,
  type Branch,
  type Extraction,
  type Issues,
} from '../model';

/**
 * Ability score increases: `ability: [{ "dex": 2, "con": 1 }]`, `{ "choose": { from, count,
 * amount } }` or the 2024 background form `{ "choose": { "weighted": { from, weights } } }`.
 * Several entries are alternatives (+2/+1 or +1/+1/+1).
 */

const NAMES: Record<Ability, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

export const abilityName = (a: Ability) => NAMES[a];

const signed = (n: number) => (n >= 0 ? `+${String(n)}` : String(n));

function readAlternative(alt: Record<string, unknown>, id: string, issues: Issues): Extraction {
  const out = emptyExtraction();
  const max = num(alt.max);
  for (const [key, value] of Object.entries(alt)) {
    // `hidden`: shown elsewhere in the text; `max`: read above.
    if (key === 'hidden' || key === 'max') continue;
    if (isAbility(key) && typeof value === 'number') {
      out.grants.push({ kind: 'ability', ability: key, amount: value, ...(max ? { max } : {}) });
      continue;
    }
    if (key === 'choose' && isObj(value)) {
      const weighted = isObj(value.weighted) ? value.weighted : undefined;
      const from = (
        Array.isArray(weighted?.from) ? weighted.from : Array.isArray(value.from) ? value.from : []
      ).filter(isAbility);
      if (from.length === 0) issues.add(id, 'ability choose without abilities');
      if (weighted) {
        const weights = (Array.isArray(weighted.weights) ? weighted.weights : []).filter(
          (w): w is number => typeof w === 'number',
        );
        out.choices.push({
          id,
          kind: 'ability',
          count: weights.length,
          label: `Increase ${weights.map(signed).join(', ')} to different abilities`,
          options: from,
          amounts: weights,
          ...(max ? { max } : {}),
        });
        for (const k of Object.keys(weighted))
          if (k !== 'from' && k !== 'weights') issues.add(id, `unknown weighted field ${k}`);
      } else {
        const count = num(value.count) ?? 1;
        const amount = num(value.amount) ?? 1;
        out.choices.push({
          id,
          kind: 'ability',
          count,
          label:
            typeof value.entry === 'string'
              ? value.entry
              : `Increase ${String(count)} ${count === 1 ? 'ability' : 'different abilities'} by ${String(amount)}`,
          options: from,
          amounts: Array.from({ length: count }, () => amount),
          ...(max ? { max } : {}),
        });
      }
      for (const k of Object.keys(value))
        if (!['from', 'count', 'amount', 'weighted', 'entry'].includes(k))
          issues.add(id, `unknown ability choose field ${k}`);
      continue;
    }
    issues.add(id, `unknown ability entry ${key}=${JSON.stringify(value)}`);
  }
  return out;
}

function describe(ex: Extraction): string {
  const fixed = ex.grants.map((g) =>
    g.kind === 'ability' ? `${abilityName(g.ability)} ${signed(g.amount)}` : '',
  );
  const picks = ex.choices.map((c) => (c.amounts ?? []).map(signed).join('/'));
  return [...fixed, ...picks].join(', ');
}

export function readAbilities(value: unknown, id: string, issues: Issues): Extraction {
  const alts = (Array.isArray(value) ? value : [value]).filter(isObj);
  if (alts.length === 1 && alts[0]) return readAlternative(alts[0], id, issues);
  const branches: Branch[] = alts.map((alt, i) => {
    const ex = readAlternative(alt, `${id}/${String(i)}`, issues);
    return { id: String(i), label: describe(ex), ...ex };
  });
  return {
    grants: [],
    choices: [
      {
        id,
        kind: 'alternative',
        count: 1,
        label: 'Choose ability score increases',
        options: branches.map((b) => b.id),
        branches,
      },
    ],
  };
}

/**
 * Tasha's / Mordenkainen's custom lineage rule (`lineage: "VRGR"`): +2 and +1, or +1 to three
 * different abilities, any abilities.
 */
export function lineageAbilities(id: string): Extraction {
  return readAbilities(
    [
      { choose: { weighted: { from: [...ABILITIES], weights: [2, 1] } } },
      { choose: { weighted: { from: [...ABILITIES], weights: [1, 1, 1] } } },
    ],
    id,
    { add: () => undefined },
  );
}
