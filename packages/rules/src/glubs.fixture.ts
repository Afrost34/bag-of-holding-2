import type { CharacterDecisions } from './build';

/**
 * Glubs Jean-Marie Shitto, the owner's level 3 bard, as decisions only. The reference sheet is a
 * PDF from the old app; the rules engine must rebuild the same character from these.
 *
 * Awaken Rope is a homebrew spell (not in 5etools): references the data does not hold are kept.
 */
export const GLUBS: CharacterDecisions = {
  schema: 1,
  edition: '2024',
  // Charlatan adds +2 Charisma and +1 Dexterity: 12, 16, 14, 14, 14, 18 on the sheet.
  baseScores: { str: 12, dex: 15, con: 14, int: 14, wis: 14, cha: 16 },
  species: 'race:goblin@mpmm',
  background: 'background:charlatan@xphb',
  classes: [{ class: 'class:bard@xphb', levels: 3 }],
  choices: {
    'character/languages': ['goblin', 'dwarvish'],
    'background:charlatan@xphb/ability': ['0'],
    'background:charlatan@xphb/ability/0': ['cha', 'dex'],
    'background:charlatan@xphb/equipment/0': ['A'],
    'feat:skilled@xphb/skillToolLanguage': ['pool:skill', 'pool:skill', 'pool:tool'],
    'feat:skilled@xphb/skillToolLanguage/0': ['stealth'],
    'feat:skilled@xphb/skillToolLanguage/1': ['acrobatics'],
    'feat:skilled@xphb/skillToolLanguage/2': ["thieves' tools"],
    'class:bard@xphb/level:1/skill': ['insight', 'performance', 'persuasion'],
    'class:bard@xphb/level:1/tool': ['bagpipes', 'drum', 'horn'],
    'class:bard@xphb/level:1/equipment/0': ['A'],
    'class:bard@xphb/level:1/equipment/0/A/2': ['item:horn@xphb'],
    'class:bard@xphb/cantrips': ['spell:mind sliver@xphb', 'spell:vicious mockery@xphb'],
    'class:bard@xphb/spells': [
      'spell:awaken rope@homebrew',
      'spell:bane@xphb',
      'spell:cause fear@xge',
      'spell:detect thoughts@xphb',
      'spell:enhance ability@xphb',
      'spell:suggestion@xphb',
    ],
    'classfeature:expertise|bard|xphb|2@xphb/expertise': ['deception', 'persuasion'],
    'class:bard@xphb/level:3/subclass': ['subclass:whispers|bard|xphb@xge'],
  },
  inventory: [
    { key: 'item:club@xphb', quantity: 1, equipped: true },
    { key: 'item:dagger@xphb', quantity: 1, equipped: true },
    { key: 'item:stone of good luck@xdmg', quantity: 1, equipped: true, attuned: true },
    { key: 'item:fine clothes@xphb', quantity: 1 },
    { key: 'item:horn@xphb', quantity: 1 },
  ],
  // 26 hit points on the sheet: 8 at level 1, then two rolls of 6, plus Constitution.
  hitPointRolls: [6, 6],
};
