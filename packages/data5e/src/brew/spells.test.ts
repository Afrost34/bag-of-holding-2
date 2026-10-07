import { describe, expect, it } from 'vitest';
import { castingTime, components, spellDuration, spellLevelSchool, spellRange } from '../format';
import { emptySpell, formToSpell, spellTags, spellToForm } from './spells';

const sunburst = {
  ...emptySpell('Rust Burst'),
  level: 3,
  school: 'V' as const,
  rangeKind: 'area' as const,
  rangeAmount: 15,
  areaShape: 'cone' as const,
  material: 'a pinch of rust',
  durationKind: 'concentration' as const,
  durationAmount: 1,
  durationUnit: 'minute' as const,
  classes: ['Sorcerer', 'Wizard'],
  description:
    'Each creature in the cone makes a Dexterity saving throw (DC 15). On a failure it takes 6d6 fire damage and is blinded.',
  higher: 'The damage increases by 1d6 for each slot level above 3.',
};

describe('spell form', () => {
  it('makes a spell the compendium shows as written', () => {
    const s = formToSpell(sunburst, '2024');
    expect(spellLevelSchool(s, '2024')).toBe('Level 3 Evocation');
    expect(castingTime(s)).toBe('1 action');
    expect(spellRange(s)).toBe('Self (15-foot cone)');
    expect(components(s)).toBe('V, S, M (a pinch of rust)');
    expect(spellDuration(s)).toBe('Concentration, up to 1 minute');
    expect(s.entries).toEqual([
      'Each creature in the cone makes a Dexterity saving throw ({@dc 15}). On a failure it takes {@damage 6d6} fire damage and is {@condition blinded}.',
    ]);
    expect(s.entriesHigherLevel).toEqual([
      {
        type: 'entries',
        name: 'Using a Higher-Level Spell Slot',
        entries: ['The damage increases by {@dice 1d6} for each slot level above 3.'],
      },
    ]);
    expect(s).toMatchObject({
      classes: {
        fromClassList: [
          { name: 'Sorcerer', source: 'XPHB' },
          { name: 'Wizard', source: 'XPHB' },
        ],
      },
      damageInflict: ['fire'],
      savingThrow: ['dexterity'],
      conditionInflict: ['blinded'],
    });
  });

  it('reads a spell back into the form, keeping the rest', () => {
    const made = { ...formToSpell(sunburst, '2014'), source: 'RS', page: 3, miscTags: ['SGT'] };
    const form = spellToForm(made);
    expect(form).toEqual(sunburst);
    expect(formToSpell(form, '2014', made)).toEqual(made);
  });

  it('reads reactions, rituals and ranges', () => {
    const shield = formToSpell(
      {
        ...emptySpell('Rust Shield'),
        castingUnit: 'reaction',
        trigger: 'which you take when you are hit',
        rangeKind: 'self',
        ritual: true,
      },
      '2014',
    );
    expect(castingTime(shield)).toBe('1 reaction, which you take when you are hit');
    expect(spellRange(shield)).toBe('Self');
    expect(spellLevelSchool(shield)).toBe('1st-level evocation (ritual)');
    expect(spellTags('No save, 2d8 radiant damage').damageInflict).toEqual(['radiant']);
  });
});
