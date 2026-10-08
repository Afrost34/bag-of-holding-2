import type { EntityDetail, RawEntity } from '@boh/data5e';
import { describe, expect, it } from 'vitest';
import { buildCharacter, newCharacter, type RulesData } from './build';
import { computeSheet } from './sheet';

function fakeData(entities: [string, string, RawEntity][]): RulesData {
  const map = new Map<string, EntityDetail>(
    entities.map(([key, type, data]) => [
      key,
      {
        key,
        type,
        name: String(data.name),
        source: String(data.source),
        edition: '2024',
        page: null,
        layer: 'homebrew',
        data,
      },
    ]),
  );
  return {
    get: (key) => map.get(key),
    withKeySuffix: (type, suffix) =>
      [...map.values()].filter((e) => e.type === type && e.key.includes(suffix)),
    featureData: () => undefined,
  };
}

describe('weapon proficiency', () => {
  it('“firearms” covers every weapon flagged as a firearm, and nothing else', () => {
    const data = fakeData([
      [
        'class:gunslinger@gs',
        'class',
        {
          name: 'Gunslinger',
          source: 'GS',
          proficiency: ['con', 'cha'],
          startingProficiencies: { weapons: ['simple', 'firearms'] },
        },
      ],
      [
        'item:pistol@gs',
        'item',
        {
          name: 'Pistol',
          source: 'GS',
          type: 'R|XPHB',
          weapon: true,
          weaponCategory: 'martial',
          firearm: true,
          dmg1: '2d6',
          dmgType: 'P',
          range: '20/30',
        },
      ],
      [
        'item:longbow@gs',
        'item',
        {
          name: 'Longbow',
          source: 'GS',
          type: 'R|XPHB',
          weapon: true,
          weaponCategory: 'martial',
          dmg1: '1d8',
          dmgType: 'P',
        },
      ],
    ]);
    const decisions = {
      ...newCharacter('2024'),
      classes: [{ class: 'class:gunslinger@gs', levels: 1 }],
      inventory: [
        { key: 'item:pistol@gs', quantity: 1 },
        { key: 'item:longbow@gs', quantity: 1 },
      ],
    };
    const sheet = computeSheet(data, decisions, buildCharacter(data, decisions));
    const proficient = (name: string) =>
      sheet.attacks
        .find((a) => a.name === name)
        ?.toHit?.parts.some((p) => p.label === 'Proficiency');
    expect(proficient('Pistol')).toBe(true);
    expect(proficient('Longbow')).toBe(false);
  });
});
