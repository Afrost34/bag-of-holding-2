import { Graphics, type Renderer, type Texture } from 'pixi.js';

/**
 * Map glyphs drawn in code (no picture files): trees, rocks, mountains, hills, reeds. Used by
 * scatter before any stamp pack is imported, and sharp at any size. Each is drawn once into a
 * texture. Every glyph fits a 100 × 100 box with its base at the bottom middle.
 */

export const GLYPHS = [
  { id: 'tree', name: 'Tree', group: 'Plants', aspect: 1 },
  { id: 'pine', name: 'Pine', group: 'Plants', aspect: 0.7 },
  { id: 'bush', name: 'Bush', group: 'Plants', aspect: 1.3 },
  { id: 'dead', name: 'Dead tree', group: 'Plants', aspect: 0.9 },
  { id: 'palm', name: 'Palm', group: 'Plants', aspect: 1 },
  { id: 'tuft', name: 'Grass tuft', group: 'Plants', aspect: 1 },
  { id: 'reed', name: 'Reeds', group: 'Plants', aspect: 0.9 },
  { id: 'rock', name: 'Rock', group: 'Stone', aspect: 1.2 },
  { id: 'hill', name: 'Hill', group: 'Stone', aspect: 1.6 },
  { id: 'mountain', name: 'Mountain', group: 'Stone', aspect: 1.15 },
  { id: 'peak', name: 'Snowy peak', group: 'Stone', aspect: 1 },
  { id: 'table', name: 'Table', group: 'Furniture', aspect: 1.4 },
  { id: 'chair', name: 'Chair', group: 'Furniture', aspect: 1 },
  { id: 'barrel', name: 'Barrel', group: 'Furniture', aspect: 1 },
  { id: 'crate', name: 'Crate', group: 'Furniture', aspect: 1 },
  { id: 'bed', name: 'Bed', group: 'Furniture', aspect: 0.6 },
  { id: 'chest', name: 'Chest', group: 'Furniture', aspect: 1.3 },
  { id: 'shelf', name: 'Bookshelf', group: 'Furniture', aspect: 3 },
] as const;

export type GlyphId = (typeof GLYPHS)[number]['id'];

export const GLYPH_PREFIX = 'glyph:';
export const glyphRef = (id: GlyphId) => `${GLYPH_PREFIX}${id}`;
export const isGlyphRef = (ref: string) => ref.startsWith(GLYPH_PREFIX);
export const glyphIdOf = (ref: string): GlyphId | null => {
  const id = ref.slice(GLYPH_PREFIX.length);
  return GLYPHS.find((g) => g.id === id)?.id ?? null;
};
/** Width ÷ height of a glyph, 1 for anything else. */
export const glyphAspect = (ref: string): number =>
  GLYPHS.find((g) => g.id === glyphIdOf(ref))?.aspect ?? 1;

const INK = 0x2b2118;

function draw(id: GlyphId): Graphics {
  const g = new Graphics();
  const outline = (w = 2) => ({ color: INK, width: w, alpha: 0.85, join: 'round' as const });
  switch (id) {
    case 'tree':
      g.rect(46, 66, 8, 34).fill({ color: 0x6b4a2b }).stroke(outline(1.5));
      for (const [x, y, r, c] of [
        [34, 54, 26, 0x4f7f2e],
        [66, 54, 26, 0x4f7f2e],
        [50, 36, 30, 0x5d9137],
      ] as const)
        g.circle(x, y, r).fill({ color: c }).stroke(outline(2));
      g.circle(44, 28, 9).fill({ color: 0x78ad4a, alpha: 0.75 });
      break;
    case 'pine':
      g.rect(46, 84, 8, 16).fill({ color: 0x6b4a2b }).stroke(outline(1.5));
      for (const [top, bottom, half, c] of [
        [46, 92, 34, 0x2f5f3a],
        [24, 70, 28, 0x37703f],
        [4, 48, 21, 0x3f7f47],
      ] as const)
        g.poly([50, top, 50 + half, bottom, 50 - half, bottom])
          .fill({ color: c })
          .stroke(outline(2));
      break;
    case 'bush':
      for (const [x, y, r, c] of [
        [30, 78, 22, 0x4a7a2c],
        [70, 78, 22, 0x4a7a2c],
        [50, 66, 26, 0x5d9137],
      ] as const)
        g.circle(x, y, r).fill({ color: c }).stroke(outline(2));
      g.circle(44, 60, 7).fill({ color: 0x7fb44e, alpha: 0.7 });
      break;
    case 'dead':
      g.moveTo(50, 100).lineTo(50, 40).stroke({ color: 0x4a3a2c, width: 7, cap: 'round' });
      for (const [x, y, from] of [
        [22, 40, 64],
        [78, 30, 54],
        [36, 12, 42],
        [64, 8, 36],
      ] as const)
        g.moveTo(50, from).lineTo(x, y).stroke({ color: 0x4a3a2c, width: 4, cap: 'round' });
      break;
    case 'palm':
      g.moveTo(50, 100)
        .quadraticCurveTo(56, 66, 48, 38)
        .stroke({ color: 0x8a6a3c, width: 7, cap: 'round' });
      for (const [x, y, cx, cy] of [
        [14, 46, 28, 22],
        [86, 46, 72, 22],
        [24, 70, 28, 40],
        [78, 70, 74, 40],
        [48, 8, 48, 18],
      ] as const)
        g.moveTo(48, 38)
          .quadraticCurveTo(cx, cy, x, y)
          .stroke({ color: 0x3f7f3a, width: 8, cap: 'round' });
      break;
    case 'tuft':
      for (const [x, lean, h] of [
        [34, -10, 40],
        [44, -4, 56],
        [52, 2, 64],
        [60, 8, 50],
        [68, 14, 38],
      ] as const)
        g.moveTo(x, 100)
          .quadraticCurveTo(x + lean / 2, 100 - h * 0.6, x + lean, 100 - h)
          .stroke({
            color: 0x4a7a2c,
            width: 4,
            cap: 'round',
          });
      break;
    case 'reed':
      for (const [x, h] of [
        [36, 60],
        [48, 84],
        [58, 70],
        [68, 52],
      ] as const) {
        g.moveTo(x, 100)
          .lineTo(x + 2, 100 - h)
          .stroke({ color: 0x5c7a3a, width: 3, cap: 'round' });
        g.roundRect(x - 1, 100 - h - 12, 6, 14, 3).fill({ color: 0x6b4a2b });
      }
      break;
    case 'rock':
      g.poly([10, 88, 22, 52, 46, 36, 72, 44, 90, 70, 86, 92, 50, 98])
        .fill({ color: 0x8a847d })
        .stroke(outline(2));
      g.poly([22, 52, 46, 36, 72, 44, 52, 62, 30, 66]).fill({ color: 0xaaa59d, alpha: 0.8 });
      g.poly([52, 62, 72, 44, 90, 70, 86, 92, 60, 90]).fill({ color: 0x5a554f, alpha: 0.55 });
      break;
    case 'hill':
      g.moveTo(4, 96)
        .bezierCurveTo(20, 40, 80, 40, 96, 96)
        .closePath()
        .fill({ color: 0x9aa56a })
        .stroke(outline(2));
      g.moveTo(52, 52)
        .bezierCurveTo(70, 56, 86, 76, 92, 94)
        .stroke({ color: 0x6f7a48, width: 3, alpha: 0.7, cap: 'round' });
      g.moveTo(18, 84)
        .quadraticCurveTo(34, 62, 50, 60)
        .stroke({ color: 0xbcc58a, width: 3, alpha: 0.8, cap: 'round' });
      break;
    case 'mountain':
      g.poly([4, 96, 38, 18, 60, 52, 72, 34, 98, 96])
        .fill({ color: 0x8c8378 })
        .stroke(outline(2.5));
      g.poly([38, 18, 60, 52, 50, 96, 30, 96, 36, 50]).fill({ color: 0x5f574e, alpha: 0.55 });
      g.poly([38, 18, 26, 40, 34, 36, 40, 44, 48, 34]).fill({ color: 0xf4f1ea });
      g.poly([72, 34, 64, 46, 70, 44, 76, 48, 80, 42]).fill({ color: 0xf4f1ea });
      break;
    case 'table':
      g.roundRect(8, 24, 84, 52, 9).fill({ color: 0x8a5a2b }).stroke(outline(2));
      for (const y of [38, 50, 62])
        g.moveTo(16, y).lineTo(84, y).stroke({ color: 0x6b4423, width: 1.5, alpha: 0.6 });
      g.circle(34, 44, 6).fill({ color: 0xd9d4c8 }).stroke(outline(1.2));
      g.circle(66, 56, 6).fill({ color: 0xd9d4c8 }).stroke(outline(1.2));
      break;
    case 'chair':
      g.roundRect(26, 26, 48, 48, 8).fill({ color: 0x9b6b3c }).stroke(outline(2));
      g.roundRect(26, 20, 48, 12, 4).fill({ color: 0x7a5230 }).stroke(outline(1.6));
      break;
    case 'barrel':
      g.circle(50, 50, 40).fill({ color: 0x8a6a3b }).stroke(outline(2.5));
      g.circle(50, 50, 31).stroke({ color: 0x5a4524, width: 3, alpha: 0.8 });
      g.circle(50, 50, 20).stroke({ color: 0x5a4524, width: 2.5, alpha: 0.7 });
      g.circle(50, 50, 9).fill({ color: 0xb08a50 });
      break;
    case 'crate':
      g.rect(14, 14, 72, 72).fill({ color: 0xa9824a }).stroke(outline(2.5));
      g.moveTo(14, 14)
        .lineTo(86, 86)
        .moveTo(86, 14)
        .lineTo(14, 86)
        .stroke({ color: 0x7a5a30, width: 4, alpha: 0.8 });
      g.rect(22, 22, 56, 56).stroke({ color: 0x7a5a30, width: 2, alpha: 0.7 });
      break;
    case 'bed':
      g.roundRect(18, 2, 64, 96, 6).fill({ color: 0x7a5230 }).stroke(outline(2));
      g.roundRect(24, 32, 52, 62, 4).fill({ color: 0xb04a4a }).stroke(outline(1.6));
      g.roundRect(26, 8, 48, 20, 6).fill({ color: 0xf1ece0 }).stroke(outline(1.4));
      break;
    case 'chest':
      g.roundRect(8, 26, 84, 50, 6).fill({ color: 0x8a5a2b }).stroke(outline(2.2));
      g.rect(8, 44, 84, 10).fill({ color: 0x55504a, alpha: 0.85 });
      g.rect(44, 38, 12, 24).fill({ color: 0xc9a227 }).stroke(outline(1.2));
      break;
    case 'shelf':
      g.rect(0, 32, 100, 36).fill({ color: 0x5c4026 }).stroke(outline(1.8));
      for (let i = 0; i < 12; i++)
        g.rect(4 + i * 7.8, 36, 5.6, 28).fill({
          color: [0x8a2f2f, 0x2f5f8a, 0x4a7a3a, 0xa8873a][i % 4] ?? 0x8a2f2f,
        });
      break;
    case 'peak':
      g.poly([10, 98, 50, 4, 90, 98]).fill({ color: 0x938a7e }).stroke(outline(2.5));
      g.poly([50, 4, 90, 98, 60, 98, 52, 40]).fill({ color: 0x5f574e, alpha: 0.5 });
      g.poly([50, 4, 32, 40, 42, 34, 50, 46, 58, 32, 66, 40]).fill({ color: 0xffffff });
      break;
  }
  return g;
}

const textures = new WeakMap<Renderer, Map<GlyphId, Texture>>();

/** The texture of a glyph, drawn once per renderer. */
export function glyphTexture(renderer: Renderer, id: GlyphId): Texture {
  let byId = textures.get(renderer);
  if (!byId) {
    byId = new Map();
    textures.set(renderer, byId);
  }
  let texture = byId.get(id);
  if (!texture) {
    const g = draw(id);
    // The box is 100 × 100 whatever is drawn in it, so every glyph sits the same way.
    g.rect(0, 0, 100, 100).fill({ color: 0xffffff, alpha: 0.0001 });
    texture = renderer.generateTexture({ target: g, resolution: 2 });
    g.destroy();
    byId.set(id, texture);
  }
  return texture;
}
