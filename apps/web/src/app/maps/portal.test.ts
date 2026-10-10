import { describe, expect, it } from 'vitest';
import { addItem, newMap } from './model';
import { isPortalPicture, portalOnWalls } from './portal';

describe('doors and windows of a pack', () => {
  it('snap to the nearest wall, drawn or of a room, and turn along it', () => {
    const blank = newMap('Walls', [], '');
    const doc = addItem(blank, blank.layers[0]?.id ?? '', {
      kind: 'wall',
      id: 'w1',
      points: [0, 0, 200, 0],
    });
    const at = portalOnWalls(doc, { x: 80, y: 12 }, 20);
    expect(at).toMatchObject({ x: 80, y: 0 });
    expect(at?.angle).toBeCloseTo(0);
    expect(portalOnWalls(doc, { x: 80, y: 60 }, 20)).toBeNull();
  });

  it('knows which pictures are doors and windows', () => {
    expect(isPortalPicture('pack:a:X/Building/Doors/Door_Metal_Gray_A_1x1.webp')).toBe(true);
    expect(isPortalPicture('pack:a:X/Building/Windows/Small_Windows/W_1x1.webp')).toBe(true);
    expect(isPortalPicture('pack:a:X/Building/Doors/Addons/Lock_1x1.webp')).toBe(false);
    expect(isPortalPicture('pack:a:X/Furniture/Chair_1x1.webp')).toBe(false);
  });
});
