import { describe, expect, it } from 'vitest';
import {
  alignment,
  armorClass,
  castingTime,
  challenge,
  components,
  creatureType,
  damageList,
  featAbility,
  itemProperties,
  itemTypeLine,
  itemValue,
  ordinal,
  prerequisite,
  sizeText,
  speed,
  spellDuration,
  spellLevelSchool,
  spellRange,
  withInheritedProperties,
} from './format';

const fireball = {
  level: 3,
  school: 'V',
  time: [{ number: 1, unit: 'action' }],
  range: { type: 'point', distance: { type: 'feet', amount: 150 } },
  components: { v: true, s: true, m: 'a tiny ball of bat guano and sulfur' },
  duration: [{ type: 'instant' }],
};

describe('spells', () => {
  it('formats the header lines', () => {
    expect(spellLevelSchool(fireball)).toBe('3rd-level evocation');
    expect(spellLevelSchool(fireball, '2024')).toBe('Level 3 Evocation');
    expect(spellLevelSchool({ level: 0, school: 'N' })).toBe('Necromancy cantrip');
    expect(spellLevelSchool({ level: 1, school: 'D', meta: { ritual: true } })).toBe(
      '1st-level divination (ritual)',
    );
    expect(castingTime(fireball)).toBe('1 action');
    expect(
      castingTime({
        time: [{ number: 1, unit: 'reaction', condition: 'which you take when hit' }],
      }),
    ).toBe('1 reaction, which you take when hit');
    expect(spellRange(fireball)).toBe('150 feet');
    expect(spellRange({ range: { type: 'cone', distance: { type: 'feet', amount: 15 } } })).toBe(
      'Self (15-foot cone)',
    );
    expect(spellRange({ range: { type: 'point', distance: { type: 'touch' } } })).toBe('Touch');
    expect(components(fireball)).toBe('V, S, M (a tiny ball of bat guano and sulfur)');
    expect(spellDuration(fireball)).toBe('Instantaneous');
    expect(
      spellDuration({
        duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }],
      }),
    ).toBe('Concentration, up to 1 minute');
    expect(spellDuration({ duration: [{ type: 'permanent', ends: ['dispel'] }] })).toBe(
      'Until dispelled',
    );
  });
});

describe('creatures', () => {
  it('formats size, type and alignment', () => {
    expect(sizeText(['M'])).toBe('Medium');
    expect(sizeText(['S', 'M'])).toBe('Small or Medium');
    expect(creatureType({ type: 'humanoid', tags: ['goblinoid'] })).toBe('humanoid (goblinoid)');
    expect(creatureType({ type: 'beast', swarmSize: 'T' })).toBe('swarm of tiny beasts');
    expect(alignment(['N', 'E'])).toBe('neutral evil');
    expect(alignment(['L', 'G'])).toBe('lawful good');
    expect(alignment(['U'])).toBe('unaligned');
    expect(alignment(['A'])).toBe('any alignment');
  });

  it('formats AC, speed, defenses and challenge', () => {
    expect(
      armorClass([{ ac: 15, from: ['{@item leather armor|phb}', '{@item shield|phb}'] }]),
    ).toBe('15 ({@item leather armor|phb}, {@item shield|phb})');
    expect(armorClass([12])).toBe('12');
    expect(speed({ walk: 30, fly: { number: 60, condition: '(hover)' }, canHover: true })).toBe(
      '30 ft., fly 60 ft. (hover)',
    );
    expect(speed({ walk: 40, climb: 40 })).toBe('40 ft., climb 40 ft.');
    expect(damageList(['fire', 'poison'], 'immune')).toBe('fire, poison');
    expect(
      damageList(
        [
          'cold',
          { resist: ['bludgeoning', 'piercing'], note: 'from nonmagical attacks', cond: true },
        ],
        'resist',
      ),
    ).toBe('cold; bludgeoning, piercing from nonmagical attacks');
    expect(challenge('1/4')).toBe('1/4 (XP 50; PB +2)');
    expect(challenge({ cr: '10', lair: '11' })).toBe('10 (XP 5,900, or 7,200 in lair; PB +4)');
  });
});

describe('items', () => {
  it('formats type, value and properties', () => {
    expect(itemTypeLine({ wondrous: true, rarity: 'uncommon', reqAttune: true })).toBe(
      'Wondrous item, uncommon (requires attunement)',
    );
    expect(itemTypeLine({ type: 'M|XPHB', rarity: 'none' })).toBe('Melee weapon');
    expect(itemValue(1500)).toBe('15 gp');
    expect(itemValue(150000)).toBe('1,500 gp');
    expect(itemValue(20)).toBe('2 sp');
    expect(itemValue(5)).toBe('5 cp');
    expect(itemProperties({ property: ['V|XPHB', 'F'], dmg2: '1d10' })).toBe(
      'versatile (1d10), finesse',
    );
  });
});

describe('prerequisites', () => {
  it('reads common shapes', () => {
    expect(prerequisite([{ level: 4 }])).toBe('4th level');
    expect(prerequisite([{ ability: [{ str: 13 }] }])).toBe('Strength 13+');
    expect(prerequisite([{ spellcasting: true }])).toBe('The ability to cast at least one spell');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(22)).toBe('22nd');
  });

  it('describes feat ability increases', () => {
    expect(featAbility([{ str: 1 }])).toBe(
      'Increase your Strength score by 1, to a maximum of 20.',
    );
    expect(featAbility([{ choose: { from: ['int', 'wis', 'cha'] } }])).toBe(
      'Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20.',
    );
    expect(
      featAbility([{ choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'] }, max: 30 }]),
    ).toBe('Increase one ability score of your choice by 1, to a maximum of 30.');
    expect(featAbility([{ choose: { from: ['str'], amount: 2 }, hidden: true }])).toBe('');
    expect(featAbility(undefined)).toBe('');
  });

  it('shows a generic variant with its inherited fields and filled templates', () => {
    const generic = withInheritedProperties({
      name: '+1 Weapon',
      type: 'GV|DMG',
      property: ['V'],
      inherits: {
        namePrefix: '+1 ',
        rarity: 'uncommon',
        bonusWeapon: '+1',
        propertyAdd: ['F'],
        entries: ['You have a {=bonusWeapon} bonus.'],
      },
    });
    expect(generic).toMatchObject({
      name: '+1 Weapon',
      rarity: 'uncommon',
      property: ['V', 'F'],
      entries: ['You have a +1 bonus.'],
    });
    expect(generic.namePrefix).toBeUndefined();
  });
});
