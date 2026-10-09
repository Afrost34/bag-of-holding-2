import type { HeldGrant } from '@boh/rules';

/** One spell on the sheet: where it comes from and how the character has it. */
export interface SheetSpell {
  key: string;
  /** What gives it: a class, species, feat or background name. */
  from: string;
  /** "Prepared", "Known", "Always prepared", "1/day"… */
  how: string;
}

const PER: Record<string, string> = { daily: 'day', rest: 'rest', resource: 'use' };

/** How a spell is had, in the sheet's words. */
function howOf(g: Extract<HeldGrant, { kind: 'spell' }>): string {
  if (g.uses) {
    if (g.uses.per === 'will') return 'At will';
    if (g.uses.per === 'ritual') return 'Ritual';
    const n = g.uses.count ?? (g.uses.countAbility ? g.uses.countAbility.toUpperCase() : 1);
    return `${String(n)}/${PER[g.uses.per] ?? g.uses.per}`;
  }
  if (g.mode === 'prepared') return g.choice ? 'Prepared' : 'Always prepared';
  if (g.mode === 'innate') return 'Innate';
  return 'Known';
}

/**
 * The spells the character has, one row each (the first grant wins when two give the same
 * spell). Spells only added to a class's list (`expanded`) are not had, so they are left out.
 */
export function sheetSpells(
  grants: readonly HeldGrant[],
  nameOf: (key: string) => string,
): SheetSpell[] {
  const rows = new Map<string, SheetSpell>();
  for (const g of grants) {
    if (g.kind !== 'spell' || g.mode === 'expanded' || rows.has(g.key)) continue;
    rows.set(g.key, { key: g.key, from: nameOf(g.from), how: howOf(g) });
  }
  return [...rows.values()];
}
