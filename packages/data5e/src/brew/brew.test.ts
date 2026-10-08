import { describe, expect, it } from 'vitest';
import { homebrewSources } from '../homebrew';
import { emptyItem, formToItem, itemToForm } from './items';
import {
  fluffImage,
  newPack,
  packCover,
  setPackCover,
  putClass,
  removeClass,
  classFeatures,
  packEntries,
  packMeta,
  putEntry,
  putFluffImage,
  removeEntry,
  sourceIdFor,
} from './pack';
import { tagDice, textToEntries, untag } from './text';

describe('homebrew text', () => {
  it('turns dice into rolls and back', () => {
    const tagged = tagDice('Deals 2d6 fire damage, or 1d4 + 1 healing. Already {@dice 1d8}.');
    expect(tagged).toBe(
      'Deals {@damage 2d6} fire damage, or {@dice 1d4 + 1} healing. Already {@dice 1d8}.',
    );
    expect(untag(tagged)).toBe('Deals 2d6 fire damage, or 1d4 + 1 healing. Already 1d8.');
  });

  it('splits paragraphs on blank lines', () => {
    expect(textToEntries('One\nline.\n\n  Two.  \n\n\n')).toEqual(['One line.', 'Two.']);
  });
});

describe('homebrew packs', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  const pack = newPack(
    {
      id: sourceIdFor('Rust & Sunfire'),
      name: 'Rust & Sunfire',
      edition: '2024',
      author: 'Arthur',
    },
    now,
  );

  it('declares a source the index accepts', () => {
    expect(sourceIdFor('Rust & Sunfire')).toBe('RustSunfire');
    expect(homebrewSources(pack)).toMatchObject([
      { id: 'RustSunfire', name: 'Rust & Sunfire', kind: 'homebrew', edition: '2024' },
    ]);
    expect(packMeta(pack)).toEqual({
      id: 'RustSunfire',
      name: 'Rust & Sunfire',
      edition: '2024',
      author: 'Arthur',
    });
  });

  it('adds, renames and removes entries', () => {
    let p = putEntry(pack, 'item', { name: 'Sunblade' }, undefined, now);
    p = putEntry(p, 'item', { name: 'Ember Orb' }, undefined, now);
    expect(packEntries(p).map((e) => [e.name, e.entity.source])).toEqual([
      ['Ember Orb', 'RustSunfire'],
      ['Sunblade', 'RustSunfire'],
    ]);
    p = putEntry(p, 'item', { name: 'Dawnblade' }, 'Sunblade', now);
    expect(packEntries(p).map((e) => e.name)).toEqual(['Dawnblade', 'Ember Orb']);
    expect(() => putEntry(p, 'item', { name: 'Ember orb' }, 'Dawnblade', now)).toThrow(/already/);
    p = removeEntry(p, 'item', 'Ember Orb', now);
    p = removeEntry(p, 'item', 'Dawnblade', now);
    expect(p.item).toBeUndefined();
  });
});

describe('item form', () => {
  it('makes a magic weapon', () => {
    const item = formToItem({
      ...emptyItem('Sunblade'),
      kind: 'weapon-melee',
      rarity: 'rare',
      attune: true,
      bonus: 2,
      weaponCategory: 'martial',
      damage: '1d8',
      damageType: 'S',
      properties: ['F', 'V'],
      versatile: '1d10',
      weight: 3,
      valueGp: 1500,
      charges: 3,
      recharge: 'dawn',
      description: 'A blade of captured sunlight.',
      abilities: [{ name: 'Flare', text: 'Spend 1 charge: the target takes 2d6 radiant damage.' }],
    });
    expect(item).toEqual({
      name: 'Sunblade',
      type: 'M',
      rarity: 'rare',
      reqAttune: true,
      bonusWeapon: '+2',
      weight: 3,
      value: 150000,
      charges: 3,
      recharge: 'dawn',
      weapon: true,
      weaponCategory: 'martial',
      dmg1: '1d8',
      dmgType: 'S',
      property: ['F', 'V'],
      dmg2: '1d10',
      entries: [
        'You have a +2 bonus to attack and damage rolls made with this magic weapon.',
        'This item has 3 charges. It regains all expended charges daily at dawn.',
        'A blade of captured sunlight.',
        {
          type: 'entries',
          name: 'Flare',
          entries: ['Spend 1 charge: the target takes {@damage 2d6} radiant damage.'],
        },
      ],
    });
  });

  it('reads its own bonus and charges sentences back as fields', () => {
    const form = {
      ...emptyItem('Wand'),
      kind: 'wand' as const,
      charges: 7,
      recharge: 'dawn',
      description: 'Zap.',
    };
    const back = itemToForm(formToItem(form));
    expect(back).toMatchObject({ charges: 7, recharge: 'dawn', description: 'Zap.' });
  });

  it('reads an item back, and keeps what the form does not show', () => {
    const imported = {
      name: 'Cloak of the Bat',
      source: 'DMG',
      page: 159,
      wondrous: true,
      rarity: 'rare',
      reqAttune: 'by a rogue',
      entries: [
        'While wearing it you have advantage on Stealth checks.',
        { type: 'list', items: ['one', 'two'] },
      ],
    };
    const form = itemToForm(imported);
    expect(form).toMatchObject({ kind: 'wondrous', attune: true, attuneBy: 'by a rogue' });
    const back = formToItem({ ...form, rarity: 'very rare' }, imported);
    expect(back).toEqual({ ...imported, rarity: 'very rare' });
  });
});

describe('pictures', () => {
  it('keeps an entry picture as 5etools fluff, following renames', () => {
    const pack = newPack({ id: 'RS', name: 'RS', edition: '2024', author: '' });
    let p = putEntry(pack, 'item', { name: 'Sunblade' });
    p = putFluffImage(p, 'item', 'Sunblade', 'data:image/webp;base64,AAAA');
    expect(fluffImage(p, 'item', 'Sunblade')).toBe('data:image/webp;base64,AAAA');
    expect(p.itemFluff).toEqual([
      {
        name: 'Sunblade',
        source: 'RS',
        images: [{ type: 'image', href: { type: 'external', url: 'data:image/webp;base64,AAAA' } }],
      },
    ]);
    p = putFluffImage(p, 'item', 'Dawnblade', 'https://example.com/a.png', 'Sunblade');
    expect(fluffImage(p, 'item', 'Sunblade')).toBeNull();
    expect(fluffImage(p, 'item', 'Dawnblade')).toBe('https://example.com/a.png');
    p = putFluffImage(p, 'item', 'Dawnblade', null);
    expect(p.itemFluff).toBeUndefined();
  });
});

describe('pack covers and classes', () => {
  const meta = { id: 'RS', name: 'Rust', edition: '2024' as const, author: '' };
  it('keeps a cover on the pack’s source', () => {
    let p = newPack(meta);
    expect(packCover(p)).toBeNull();
    p = setPackCover(p, 'data:image/webp;base64,AA');
    expect(packCover(p)).toBe('data:image/webp;base64,AA');
    expect(packMeta(p)).toEqual(meta);
    expect(packCover(setPackCover(p, null))).toBeNull();
  });
  it('swaps a class’s features as a set, and follows a rename', () => {
    const f = (name: string, className: string) => ({ name, className, level: 1 });
    let p = putClass(newPack(meta), { name: 'Corsair' }, [f('Sea Dog', 'Corsair')]);
    p = putClass(
      p,
      { name: 'Pirate' },
      [f('Plunder', 'Pirate'), f('Sea Dog', 'Pirate')],
      'Corsair',
    );
    expect(classFeatures(p, 'Corsair')).toEqual([]);
    expect(classFeatures(p, 'Pirate').map((x) => x.name)).toEqual(['Plunder', 'Sea Dog']);
    expect(packEntries(p).map((e) => e.name)).toEqual(['Pirate']);
    p = removeClass(p, 'Pirate');
    expect(p.classFeature).toBeUndefined();
    expect(packEntries(p)).toEqual([]);
  });
});
