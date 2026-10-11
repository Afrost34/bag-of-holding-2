import { describe, expect, it } from 'vitest';
import { groupVariants } from './packVariants';

const e = (path: string, pack = 'p') => ({ path, pack });

describe('stamps and their variations', () => {
  it('lists a stamp in several colours once, with its variations', () => {
    const groups = groupVariants([
      e('Flora/Trees/Tree_Green_B1_5x5.webp'),
      e('Flora/Trees/Tree_Red_B1_5x5.webp'),
      e('Flora/Trees/Tree_Multicolor1_B1_5x5.webp'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.variants.map((v) => v.label)).toEqual(['Green', 'Red', 'Multicolor1']);
    expect(groups[0]?.name).toBe('Tree B1');
    expect(groups[0]?.head.path).toContain('Tree_Green_B1');
  });

  it('keeps pictures with another shape code apart', () => {
    const groups = groupVariants([
      e('Trees/Tree_Green_A1_6x6.webp'),
      e('Trees/Tree_Green_B1_5x5.webp'),
      e('Trees/Tree_Red_B1_5x5.webp'),
    ]);
    expect(groups.map((g) => g.variants.length)).toEqual([1, 2]);
  });

  it('never merges things that differ in what they are, or sit in other folders or packs', () => {
    expect(groupVariants([e('F/Chair_Wood_A1.webp'), e('F/Table_Wood_A1.webp')])).toHaveLength(2);
    expect(groupVariants([e('A/Door_Wood_A_1x1.webp'), e('B/Door_Metal_A_1x1.webp')])).toHaveLength(
      2,
    );
    expect(
      groupVariants([e('F/Door_Wood_A_1x1.webp', 'p'), e('F/Door_Metal_A_1x1.webp', 'q')]),
    ).toHaveLength(2);
  });

  it('needs the words to differ in one place only', () => {
    const groups = groupVariants([
      e('F/Table_Legs_Wood_Ashen_E1.webp'),
      e('F/Table_Legs_Metal_Black_E1.webp'),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('keeps the order: a group stands where its first picture does', () => {
    const groups = groupVariants([
      e('F/Bench_A1.webp'),
      e('F/Door_Wood_A.webp'),
      e('F/Cart_A1.webp'),
      e('F/Door_Metal_A.webp'),
    ]);
    expect(groups.map((g) => g.name)).toEqual(['Bench A1', 'Door A', 'Cart A1']);
  });

  it('leaves lone pictures as groups of one', () => {
    const [only] = groupVariants([e('F/Barrel_A1.webp')]);
    expect(only?.variants).toHaveLength(1);
    expect(only?.variants[0]?.label).toBe('');
  });
});
