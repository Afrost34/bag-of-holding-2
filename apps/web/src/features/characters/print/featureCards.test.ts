import { describe, expect, it } from 'vitest';
import { asksOnly, lineageTrait, plainText, withoutReferences } from './featureCards';

describe('feature cards', () => {
  it('leave out references to features that print on their own', () => {
    const text = withoutReferences([
      'Your patron is a mysterious entity from the Shadowfell.',
      { type: 'refSubclassFeature', subclassFeature: 'Hex Warrior|Warlock|XPHB|Hexblade|RS|3' },
      {
        type: 'options',
        entries: [{ type: 'refOptionalfeature', optionalfeature: 'Agonizing Blast|XPHB' }],
      },
      { type: 'entries', name: 'Luck Points', entries: ['You have Luck Points.'] },
    ]);
    expect(text).toEqual([
      'Your patron is a mysterious entity from the Shadowfell.',
      { type: 'entries', name: 'Luck Points', entries: ['You have Luck Points.'] },
    ]);
    expect(plainText(['Cast {@spell Detect Magic|XPHB}.'])).toBe('Cast Detect Magic.');
  });

  it('skip features that only ask for a subclass or an option', () => {
    const choices = [
      { kind: 'subclass', via: 'classfeature:warlock subclass' },
      { kind: 'optionalfeature', via: 'classfeature:eldritch invocations' },
      { kind: 'feature', via: 'classfeature:primal order' },
    ];
    const long = ['You gain eldritch invocations. '.repeat(10)];
    expect(asksOnly({ key: 'classfeature:warlock subclass', name: 'Warlock Subclass' }, choices, long)).toBe(true);
    expect(asksOnly({ key: 'x', name: 'Eldritch Invocation Options' }, choices, long)).toBe(true);
    expect(asksOnly({ key: 'classfeature:primal order', name: 'Primal Order' }, choices, ['Choose a role.'])).toBe(true);
    expect(asksOnly({ key: 'classfeature:eldritch invocations', name: 'Eldritch Invocations' }, choices, long)).toBe(false);
    expect(asksOnly({ key: 'classfeature:hex warrior', name: 'Hex Warrior' }, choices, ['Short.'])).toBe(false);
  }); // prettier-ignore

  it('tell a species trait as the chosen lineage', () => {
    const elf = {
      key: 'race:elf@xphb',
      data: {
        additionalSpells: [{ name: 'Drow' }, { name: 'High Elf' }, { name: 'Wood Elf' }],
        _versions: [
          {
            name: 'Elf; Wood Elf Lineage',
            _mod: {
              entries: {
                mode: 'replaceArr',
                replace: 'Elven Lineage',
                items: { name: 'Elven Lineage (Wood Elf)', entries: ['Your Speed increases to 35 feet.'] },
              },
            },
          },
        ],
      },
    };
    const decisions = { choices: { 'race:elf@xphb/spells': ['2'] } };
    expect(lineageTrait(elf, 'Elven Lineage', decisions)).toEqual(['Your Speed increases to 35 feet.']);
    expect(lineageTrait(elf, 'Darkvision', decisions)).toBeUndefined();
  }); // prettier-ignore

  it('leaves tables too long for a card off it, with one line saying so', () => {
    const rows = Array.from({ length: 50 }, (_, n) => [String(n), 'Something wild']);
    expect(
      withoutReferences([
        'Your spellcasting can unleash surges.',
        { type: 'table', caption: 'Wild Magic Surge', rows },
        { type: 'table', caption: 'Beast Shapes', rows: rows.slice(0, 3) },
      ]),
    ).toEqual([
      'Your spellcasting can unleash surges.',
      '{@i Wild Magic Surge tables: too long for a card, see them in the app.}',
    ]);
    // Short tables stay.
    const short = [{ type: 'table', caption: 'Beast Shapes', rows: rows.slice(0, 3) }];
    expect(withoutReferences(short)).toEqual(short);
    // Several that add up to too many go together, under one line.
    const plans = [10, 9].map((n, i) => ({
      type: 'table',
      caption: `Magic Item Plans (Level ${String(i)})`,
      rows: rows.slice(0, n),
    }));
    expect(withoutReferences(plans)).toEqual([
      '{@i Magic Item Plans tables: too long for a card, see them in the app.}',
    ]);
  });
});
