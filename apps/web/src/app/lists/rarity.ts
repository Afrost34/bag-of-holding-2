const RARITY_CLASS: Record<string, string> = {
  uncommon: 'text-rarity-uncommon',
  rare: 'text-rarity-rare',
  'very rare': 'text-rarity-very-rare',
  legendary: 'text-rarity-legendary',
  artifact: 'text-rarity-artifact',
};

/** Text colour for an item rarity (none for common and mundane items). */
export function rarityClass(rarity: unknown): string | undefined {
  return typeof rarity === 'string' ? RARITY_CLASS[rarity] : undefined;
}
