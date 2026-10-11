import { describe, expect, it } from 'vitest';
import { colourVariants, folderIndex, nameParts, shapeVariants } from './packNames';

/** Real Forgotten Adventures names (Core 1.04), the zip's top folder cut. */
const CHAIRS = '!Core_Settlements/Furniture/Seating/Chairs/';
const WARDROBES = '!Core_Settlements/Furniture/Cupboards_and_Wardrobes/Wardrobes/';
const DOORS = '!Core_Settlements/Structures/Building/Doors/';
const REAL = [
  ...[
    'Scissor_Chair_Wood_Ashen_A1_1x1',
    'Scissor_Chair_Wood_Ashen_A1_Black_1x1',
    'Scissor_Chair_Wood_Ashen_A1_Blue_1x1',
    'Scissor_Chair_Wood_Ashen_A1_Red_1x1',
    'Scissor_Chair_Wood_Ashen_B1_1x1',
    'Scissor_Chair_Wood_Dark_A1_1x1',
    'Scissor_Chair_Wood_Dark_A1_Blue_1x1',
    'Scissor_Chair_Wood_Light_A1_Blue_1x1',
    'Scissor_Chair_Wood_Light_B1_1x1',
  ].map((n) => `${CHAIRS}${n}.webp`),
  ...[
    'Wardrobe_Wood_Ashen_A1_2x1',
    'Wardrobe_Wood_Ashen_A2_2x1',
    'Wardrobe_Wood_Ashen_B1_2x1',
    'Wardrobe_Wood_Dark_A1_2x1',
    'Wardrobe_Wood_Dark_A2_2x1',
  ].map((n) => `${WARDROBES}${n}.webp`),
  ...['Door_Metal_Gray_A_1x1', 'Door_Metal_Gray_E1_1x1', 'Door_Metal_Gray_E2_1x1'].map(
    (n) => `${DOORS}${n}.webp`,
  ),
].map((path) => ({ pack: 'fa', path }));

const index = folderIndex(REAL);

describe('nameParts', () => {
  it('reads the code and the size', () => {
    const p = nameParts(`${CHAIRS}Scissor_Chair_Wood_Ashen_A1_Blue_1x1.webp`);
    expect(p.folder).toBe(CHAIRS);
    expect(p.code).toEqual({ set: 'A', n: 1, at: 4 });
    expect(p.size).toEqual({ w: 1, h: 1 });
  });

  it('has no code when the name has none', () => {
    expect(nameParts(`${DOORS}Door_Metal_Gray_A_1x1.webp`).code).toBeNull();
  });
});

describe('folderIndex', () => {
  it('is made once per list', () => {
    expect(folderIndex(REAL)).toBe(index);
    expect(index.get(`fa:${WARDROBES}`)).toHaveLength(5);
  });
});

describe('shapeVariants', () => {
  it('finds the other shapes of the same set and size', () => {
    const me = `${WARDROBES}Wardrobe_Wood_Ashen_A1_2x1.webp`;
    expect(shapeVariants(index, 'fa', me)).toEqual([
      me,
      `${WARDROBES}Wardrobe_Wood_Ashen_A2_2x1.webp`,
    ]);
  });

  it('never mixes sets or materials', () => {
    const me = `${WARDROBES}Wardrobe_Wood_Ashen_B1_2x1.webp`;
    expect(shapeVariants(index, 'fa', me)).toEqual([me]);
  });

  it('keeps a picture without a code alone', () => {
    const me = `${DOORS}Door_Metal_Gray_A_1x1.webp`;
    expect(shapeVariants(index, 'fa', me)).toEqual([me]);
  });

  it('finds coded doors', () => {
    const me = `${DOORS}Door_Metal_Gray_E1_1x1.webp`;
    expect(shapeVariants(index, 'fa', me)).toContain(`${DOORS}Door_Metal_Gray_E2_1x1.webp`);
  });
});

describe('colourVariants', () => {
  it('finds the other woods and the other cushions of a chair', () => {
    const me = `${CHAIRS}Scissor_Chair_Wood_Ashen_A1_Blue_1x1.webp`;
    const found = colourVariants(index, 'fa', me);
    expect(found[0]).toEqual({ path: me, label: '', at: -1 });
    const labels = found.slice(1).map((v) => v.label);
    expect(labels.sort()).toEqual(['Black', 'Dark', 'Light', 'Red']);
  });

  it('never swaps the code or the size', () => {
    const me = `${WARDROBES}Wardrobe_Wood_Ashen_A1_2x1.webp`;
    const labels = colourVariants(index, 'fa', me).map((v) => v.label);
    expect(labels).toEqual(['', 'Dark']);
  });
});
