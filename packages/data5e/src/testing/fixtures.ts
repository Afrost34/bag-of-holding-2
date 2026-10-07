import { LocalDataSource } from '../dataSource';

/** A tiny 5etools-shaped dataset for fast unit tests. Mutate a copy to simulate releases. */
export function fixtureFiles(): Record<string, unknown> {
  return {
    'data/books.json': {
      book: [
        {
          name: "Player's Handbook (2014)",
          id: 'PHB',
          source: 'PHB',
          group: 'core',
          published: '2014-08-19',
        },
        {
          name: "Player's Handbook (2024)",
          id: 'XPHB',
          source: 'XPHB',
          group: 'core',
          published: '2024-09-17',
        },
        {
          name: 'Monster Manual (2014)',
          id: 'MM',
          source: 'MM',
          group: 'core',
          published: '2014-09-30',
        },
        {
          name: 'Plane Shift: Amonkhet',
          id: 'PS-A',
          source: 'PSA',
          group: 'setting',
          published: '2017-07-05',
        },
      ],
    },
    'data/adventures.json': {
      adventure: [
        {
          name: 'Lost Mine of Phandelver',
          id: 'LMoP',
          source: 'LMoP',
          group: 'supplement',
          storyline: 'Starter Set',
          level: { start: 1, end: 5 },
          published: '2014-07-15',
          contents: [
            { name: 'Introduction' },
            {
              name: 'Goblin Arrows',
              ordinal: { type: 'part', identifier: 1 },
              headers: ['Goblin Ambush', 'Cragmaw Hideout'],
            },
            { name: 'Phandalin', ordinal: { type: 'part', identifier: 2 } },
          ],
        },
      ],
    },
    'data/adventure/adventure-lmop.json': {
      data: [
        { type: 'section', name: 'Introduction', entries: ['Welcome, adventurers.'] },
        {
          type: 'section',
          name: 'Part 1: Goblin Arrows',
          entries: [
            { type: 'entries', name: 'Goblin Ambush', entries: ['Four goblins attack.'] },
            {
              type: 'entries',
              name: 'Cragmaw Hideout',
              entries: ['The goblins retreat to {@area the cave mouth|lmop-cave|x}.'],
            },
          ],
        },
        {
          type: 'section',
          name: 'Part 2: Phandalin',
          entries: [
            'The town of Phandalin.',
            {
              type: 'entries',
              id: 'lmop-cave',
              name: '1. Cave Mouth',
              entries: ['A stream flows out of the cave.'],
            },
          ],
        },
      ],
    },
    'data/spells/spells-phb.json': {
      spell: [
        { name: 'Fireball', source: 'PHB', page: 241, level: 3, reprintedAs: ['Fireball|XPHB'] },
        { name: 'Magic Missile', source: 'PHB', page: 257, level: 1 },
      ],
    },
    'data/spells/spells-xphb.json': {
      spell: [{ name: 'Fireball', source: 'XPHB', page: 274, level: 3 }],
    },
    'data/bestiary/bestiary-mm.json': {
      monster: [
        {
          name: 'Goblin',
          source: 'MM',
          page: 166,
          cr: '1/4',
          dex: 14,
          action: [{ name: 'Scimitar', entries: ['{@hit 4} to hit, the goblin slashes.'] }],
        },
        {
          name: 'Goblin Boss',
          source: 'MM',
          page: 166,
          _copy: {
            name: 'Goblin',
            source: 'MM',
            _mod: {
              action: {
                mode: 'appendArr',
                items: { name: 'Multiattack', entries: ['Two attacks.'] },
              },
              '*': { mode: 'replaceTxt', replace: 'the goblin', with: 'the boss' },
            },
          },
          cr: '1',
        },
      ],
    },
    'data/class/fluff-class-bard.json': {
      classFluff: [
        {
          name: 'Bard',
          source: 'PHB',
          images: [
            {
              type: 'image',
              title: 'An Inspiring Performer',
              href: { type: 'internal', path: 'classes/PHB/Bard.webp' },
            },
          ],
          entries: [
            'Bards weave magic through words and music. They inspire allies and demoralize foes.',
          ],
        },
      ],
    },
    'data/class/class-bard.json': {
      class: [
        {
          name: 'Bard',
          source: 'PHB',
          page: 51,
          hd: { number: 1, faces: 8 },
          proficiency: ['dex', 'cha'],
          multiclassing: { requirements: { cha: 13 } },
          startingProficiencies: {
            skills: [{ any: 3 }],
            weapons: ['simple'],
            armor: ['light'],
          },
          classTableGroups: [
            {
              colLabels: ['Cantrips Known'],
              rows: Array.from({ length: 20 }, (_, i) => [i < 3 ? 2 : 3]),
            },
          ],
          classFeatures: [
            'Bardic Inspiration|Bard||1',
            { classFeature: 'Bard College|Bard||3', gainSubclassFeature: true },
          ],
        },
      ],
      subclass: [
        {
          name: 'College of Lore',
          shortName: 'Lore',
          source: 'PHB',
          className: 'Bard',
          classSource: 'PHB',
          subclassFeatures: ['College of Lore|Bard||Lore||3'],
        },
      ],
      subclassFeature: [
        {
          name: 'College of Lore',
          source: 'PHB',
          className: 'Bard',
          classSource: 'PHB',
          subclassShortName: 'Lore',
          subclassSource: 'PHB',
          level: 3,
          entries: ['Lore bards know something about most things.'],
        },
      ],
      classFeature: [
        {
          name: 'Bardic Inspiration',
          source: 'PHB',
          className: 'Bard',
          classSource: 'PHB',
          level: 1,
          entries: ['You can inspire others, granting a {@dice d6}.'],
        },
        {
          name: 'Bard College',
          source: 'PHB',
          className: 'Bard',
          classSource: 'PHB',
          level: 3,
          entries: ['You delve into the advanced techniques of a bard college.'],
        },
      ],
    },
    'data/tables.json': {
      table: [
        {
          name: 'Wild Surge',
          source: 'PHB',
          colLabels: ['d4', 'Effect'],
          rows: [
            ['1', 'You cast {@spell Magic Missile|PHB}.'],
            ['2', 'You turn blue.'],
            ['3–4', 'Nothing happens.'],
          ],
        },
      ],
    },
    'data/races.json': {
      race: [
        {
          name: 'Elf',
          source: 'PHB',
          size: ['M'],
          speed: 30,
          ability: [{ dex: 2 }],
          entries: [{ type: 'entries', name: 'Darkvision', entries: ['You can see in the dark.'] }],
        },
      ],
      subrace: [
        {
          name: 'High',
          source: 'PHB',
          raceName: 'Elf',
          raceSource: 'PHB',
          ability: [{ int: 1 }],
          entries: [
            { type: 'entries', name: 'Cantrip', entries: ['You know one wizard cantrip.'] },
          ],
        },
      ],
    },
    'data/book/book-ps-a.json': {
      data: [{ type: 'section', name: 'Amonkhet', entries: ['Gods.'] }],
    },
    'data/generated/gendata-nav-adventure-book-index.json': {
      book: [{ name: 'Duplicate of PHB', source: 'PHB' }],
    },
    'data/foundry-spells.json': { spell: [{ name: 'Ignored', source: 'PHB' }] },
    'js/parser.js':
      'Parser.SRC_GEN = "GEN";\nParser.SOURCE_JSON_TO_FULL[Parser.SRC_GEN] = "Generic";\n' +
      'Parser.SRC_LMoP = "LMoP";\nParser.SOURCE_JSON_TO_FULL[Parser.SRC_LMoP] = "Lost Mine of Phandelver";\n',
  };
}

export function fixtureSource(
  files: Record<string, unknown> = fixtureFiles(),
  version = 'v1.0.0',
): LocalDataSource {
  const encoder = new TextEncoder();
  return new LocalDataSource(
    Object.entries(files).map(([path, content]) => [
      path,
      encoder.encode(typeof content === 'string' ? content : JSON.stringify(content)),
    ]),
    version,
  );
}
