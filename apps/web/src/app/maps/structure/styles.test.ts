import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from '../__fixtures__/faNames';
import { TERRAINS } from '../terrain';
import { resolveStyle, STYLES, styleById } from './styles';

/** What each style's walls, floor, door and roof are made of, on the real FA names. */
const EXPECTED: Record<string, { wall: string; floor: string; door: string; roof: string }> = {
  stone: { wall: 'Wall_Stone', floor: 'Textures/', door: 'Door_Wood', roof: 'Roof_Texture' },
  timber: { wall: 'Wall_PlasterWood', floor: 'Wooden', door: 'Door_Wood', roof: 'Roof_Texture' },
  desert: {
    wall: 'Wall_Adobe_Sandstone',
    floor: 'Stone_Tile_Medium_Sandstone',
    door: 'Door_Wood_Light',
    roof: 'Roof_Texture_Tile_Tan',
  },
  dwarven: {
    wall: 'Dwarven_Wall_Stone_Slate',
    floor: 'Dwarven_Stone',
    door: 'Door_Stone_Slate',
    roof: 'Roof_Texture_Slate',
  },
  drow: {
    wall: 'Drow_Wall_Stone_Purple',
    floor: 'Drow_Stone_Patterned',
    door: 'Door_Stone_Volcanic',
    roof: 'Roof_Texture_Slate',
  },
  arctic: {
    wall: 'Shack_Wall_Wood_A_Frosty',
    floor: 'Shack_Floor_Wood_Frosty',
    door: 'Shack_Door_Wood_Frosty',
    roof: 'Roof_Texture_Slate_Snowy',
  },
  industrial: {
    wall: 'Wall_Metal_Gray',
    floor: 'Metal_Square_Panels',
    door: 'Door_Metal_Gray',
    roof: 'Corrugated_Metal_Gray',
  },
  rust: {
    wall: 'Wall_Metal_Rusty',
    floor: 'Metal_Square_Panels',
    door: 'Door_Metal_Rusty',
    roof: 'Corrugated_Metal_Rusty',
  },
  heliark: {
    wall: 'Wall_StoneMetal_Earthy_Gray',
    floor: 'Dwarven_Stone',
    door: 'Door_Stone_Earthy',
    roof: 'Roof_Texture_Slate',
  },
};

describe('building styles', () => {
  it('each style picks its walls, floor, door and roof from its own set on the real packs', () => {
    for (const [id, want] of Object.entries(EXPECTED)) {
      const p = resolveStyle(styleById(id), FA_ENTRIES);
      expect(p.wall, id).toContain(want.wall);
      expect(p.floor, id).toContain(want.floor);
      expect(p.door, id).toContain(want.door);
      expect(p.roof, id).toContain(want.roof);
    }
  });

  it('gives every building style stairs and windows, and chimneys to the ones with hearths', () => {
    // Caves have no stairs, windows or roofs (one floor, underground).
    for (const style of STYLES.filter((s) => s.stairs.length > 0)) {
      const p = resolveStyle(style, FA_ENTRIES);
      expect(p.stairs, style.id).toMatch(/Stairs_[A-Za-z]+_[A-Za-z]+_A_1x3/);
      expect(p.window, style.id).toBeDefined();
      if (style.chimney.length > 0) expect(p.chimney, style.id).toContain('/Roofs/Chimneys/');
      else expect(p.chimney, style.id).toBeUndefined();
    }
  });

  it('picks a hard floor for working rooms where the style has one', () => {
    expect(resolveStyle(styleById('timber'), FA_ENTRIES).hardFloor).toBeDefined();
    expect(String(resolveStyle(styleById('rust'), FA_ENTRIES).hardFloor)).toContain('Metal_Floor');
    expect(resolveStyle(styleById('dwarven'), FA_ENTRIES).hardFloor).toBeUndefined();
  });

  it('gives caves a cave floor and a cave cliff for walls', () => {
    const p = resolveStyle(styleById('cave'), FA_ENTRIES);
    expect(p.wall).toMatch(/Cave.*_Path/i);
    expect(p.floor).toContain('Cave_Floor');
    expect(p.door).toBeUndefined();
    expect(p.roof).toBeUndefined();
  });

  it('falls back to drawn floors and ink walls without packs', () => {
    for (const style of STYLES) {
      const p = resolveStyle(style, []);
      expect(
        TERRAINS.some((t) => t.id === p.floor),
        style.id,
      ).toBe(true);
      expect(p.wall).toBeUndefined();
    }
  });
});
