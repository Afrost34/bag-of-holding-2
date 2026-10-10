import { describe, expect, it } from 'vitest';
import {
  commonRoot,
  displayName,
  findPackEntries,
  foldersUnder,
  packId,
  packRef,
  parsePackRef,
  squaresOf,
} from './packModel';

const e = (path: string) => ({ path });
const entries = [
  'Desert/Base/Decor/Pungi_Wood_A1_1x1.webp',
  'Desert/Base/Decor/Rug_Red_B2_3x2.webp',
  'Desert/Base/Trees/Palm_A1_2x2.webp',
  'Desert/Oasis/Palm_B1_2x2.webp',
  'Arctic/Igloo_1x1.webp',
].map(e);

describe('pack names', () => {
  it('give the size in squares and a name to show', () => {
    expect(squaresOf('A/Rug_Red_B2_3x2.webp')).toEqual({ w: 3, h: 2 });
    expect(squaresOf('A/Plain.webp')).toBeNull();
    expect(displayName('Desert/Base/Rug_Red_B2_3x2.webp')).toBe('Rug Red B2');
  });

  it('find the folder every file shares', () => {
    expect(commonRoot(['FA/a.webp', 'FA/b/c.webp'])).toBe('FA');
    expect(commonRoot(['FA/a.webp', 'Other/b.webp'])).toBe('');
  });

  it('round-trip as stamp references, and ids follow the contents', () => {
    expect(parsePackRef(packRef('abc-1', 'Desert/Palm.webp'))).toEqual({
      pack: 'abc-1',
      path: 'Desert/Palm.webp',
    });
    expect(parsePackRef('Forest/oak.png')).toBeNull();
    expect(packId(['a', 'b'], 10)).toBe(packId(['a', 'b'], 10));
    expect(packId(['a', 'b'], 10)).not.toBe(packId(['a', 'c'], 10));
  });
});

describe('browsing a pack', () => {
  it('lists the folders under a folder with their counts', () => {
    expect(foldersUnder(entries, '')).toEqual([
      { name: 'Arctic', count: 1 },
      { name: 'Desert', count: 4 },
    ]);
    expect(foldersUnder(entries, 'Desert')).toEqual([
      { name: 'Base', count: 3 },
      { name: 'Oasis', count: 1 },
    ]);
  });

  it('lists pictures in a folder, or finds them below it by words', () => {
    expect(findPackEntries(entries, 'Desert/Base/Decor', '', 10).list).toHaveLength(2);
    const palms = findPackEntries(entries, 'Desert', 'palm', 10);
    expect(palms.total).toBe(2);
    expect(findPackEntries(entries, '', 'rug red', 10).total).toBe(1);
    const limited = findPackEntries(entries, 'Desert', 'palm', 1);
    expect([limited.list.length, limited.total]).toEqual([1, 2]);
  });
});
