/**
 * How many times a feature can be used before it recharges, read from what the character sheet
 * knows: the class table's column for it ("Rages", "Wild Shape", "Channel Divinity"), or its
 * text ("once", "twice", "a number of times equal to your Proficiency Bonus", "…equal to your
 * Charisma modifier (minimum of once)"). Printed cards show that many boxes to tick.
 */

export interface FeatureUses {
  count: number;
  /** When the uses come back: "Long Rest", "Short or Long Rest", "Dawn"… */
  per?: string;
}

export interface UsesContext {
  proficiencyBonus: number;
  /** Ability modifiers by full name, lowercase ("charisma"). */
  modifiers: Readonly<Record<string, number>>;
  /** The class table at the character's level. */
  classTable: readonly { label: string; value: string }[];
}

/** More boxes than this is a resource to count, not tick. */
const MOST = 12;
const WORDS: Record<string, number> = { once: 1, twice: 2, 'three times': 3, 'four times': 4 };

function rechargeOf(text: string): string | undefined {
  if (text.includes('short or long rest')) return 'Short or Long Rest';
  if (text.includes('long rest')) return 'Long Rest';
  if (text.includes('short rest')) return 'Short Rest';
  if (/\bdawn\b/.test(text)) return 'Dawn';
  return undefined;
}

export function featureUses(name: string, text: string, ctx: UsesContext): FeatureUses | null {
  const lower = text.toLowerCase();
  const per = rechargeOf(lower);
  const withPer = (count: number): FeatureUses | null =>
    count > 0 && count <= MOST ? { count, ...(per ? { per } : {}) } : null;

  // The class table names the feature: its column is the number of uses at this level.
  const key = name.toLowerCase();
  const column = ctx.classTable.find((c) => {
    const label = c.label.toLowerCase();
    return label === key || label.replace(/s$/, '') === key || key.startsWith(label);
  });
  const fromTable = column ? Number(column.value) : NaN;
  if (Number.isInteger(fromTable) && per) return withPer(fromTable);

  // Uses that come back are what boxes are for: a feature with no rest or dawn has none.
  if (!per) return null;
  const pb = /number of times equal to (twice )?your proficiency bonus/.exec(lower);
  if (pb) return withPer(ctx.proficiencyBonus * (pb[1] ? 2 : 1));
  const mod =
    /number of times equal to your (strength|dexterity|constitution|intelligence|wisdom|charisma) modifier/.exec(
      lower,
    );
  if (mod) return withPer(Math.max(1, ctx.modifiers[mod[1] ?? ''] ?? 1));
  const word = /\b(once|twice|three times|four times)\b/.exec(lower);
  if (word) return withPer(WORDS[word[1] ?? ''] ?? 1);
  if (/can't (?:use (?:it|this feature)|do so) again until you finish/.test(lower))
    return withPer(1);
  return null;
}
