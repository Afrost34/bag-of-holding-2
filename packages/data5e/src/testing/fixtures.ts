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
    'data/adventures.json': { adventure: [] },
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
    'data/class/class-bard.json': {
      class: [{ name: 'Bard', source: 'PHB', page: 51 }],
      subclass: [
        {
          name: 'College of Lore',
          shortName: 'Lore',
          source: 'PHB',
          className: 'Bard',
          classSource: 'PHB',
        },
      ],
      classFeature: [
        {
          name: 'Bardic Inspiration',
          source: 'PHB',
          className: 'Bard',
          classSource: 'PHB',
          level: 1,
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
      'Parser.SRC_GEN = "GEN";\nParser.SOURCE_JSON_TO_FULL[Parser.SRC_GEN] = "Generic";\n',
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
