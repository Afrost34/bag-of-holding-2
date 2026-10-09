/** The parts of the printed sheet, each of which can be left out. */
export const PRINT_SECTIONS = [
  { id: 'main', label: 'Main page' },
  { id: 'spellcasting', label: 'Spellcasting' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'features', label: 'Features' },
  { id: 'story', label: 'Personality and backstory' },
  { id: 'spellCards', label: 'Spell cards' },
  { id: 'featureCards', label: 'Feature cards' },
  { id: 'itemCards', label: 'Item cards' },
  { id: 'companionCards', label: 'Companion cards' },
] as const;

export type PrintSection = (typeof PRINT_SECTIONS)[number]['id'];
