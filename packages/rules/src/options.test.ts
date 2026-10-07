import { describe, expect, it } from 'vitest';
import { matchesItemFilter, matchesSpellFilter } from './options';

describe('option filters', () => {
  const sliver = { name: 'Mind Sliver', level: 0, school: 'E', spellAttack: [] };
  const shield = { name: 'Shield', level: 1, school: 'A', meta: { ritual: false } };

  it('matches spells by level, class (any case), school and ritual', () => {
    expect(matchesSpellFilter(sliver, 'level=0|class=Bard', ['Bard', 'Sorcerer'])).toBe(true);
    expect(matchesSpellFilter(sliver, 'level=0|class=Wizard', ['Bard'])).toBe(false);
    expect(matchesSpellFilter(shield, 'level=1;2|school=A', [])).toBe(true);
    expect(matchesSpellFilter(shield, 'level=1|components & miscellaneous=ritual', [])).toBe(false);
    expect(matchesSpellFilter(shield, '', [])).toBe(true);
  });

  it('matches items by weapon type and properties', () => {
    const rapier = { weaponCategory: 'martial', type: 'M|XPHB', property: ['F|XPHB'] };
    const greatsword = {
      weaponCategory: 'martial',
      type: 'M|XPHB',
      property: ['H|XPHB', '2H|XPHB'],
    };
    expect(matchesItemFilter(rapier, 'type=martial weapon|property=light;finesse')).toBe(true);
    expect(matchesItemFilter(greatsword, 'type=martial weapon|property=!two-handed')).toBe(false);
    expect(matchesItemFilter(rapier, 'type=simple weapon')).toBe(false);
  });
});
