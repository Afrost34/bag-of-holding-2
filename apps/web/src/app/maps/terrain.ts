/**
 * Terrain textures for the terrain brush, drawn in code (no picture files): grass, water, sand…
 * Each is a small seamless tile, repeated under the brush stroke. The same seed gives the same
 * tile, so a map looks the same every time it opens.
 */

export const TERRAINS = [
  { id: 'grass', name: 'Grass', base: '#5b8a2b', marks: ['#4a7524', '#6d9e35', '#3f6a1d'] },
  { id: 'dirt', name: 'Dirt', base: '#8a6a45', marks: ['#7a5c3b', '#9c7a52', '#6b4f33'] },
  { id: 'sand', name: 'Sand', base: '#d9bf86', marks: ['#cdb178', '#e4cc96', '#c4a66c'] },
  { id: 'water', name: 'Water', base: '#3d7fb0', marks: ['#4b8fc0', '#336f9c', '#5a9cca'] },
  { id: 'rock', name: 'Rock', base: '#77716b', marks: ['#68625c', '#8a847d', '#5a554f'] },
  { id: 'stone', name: 'Stone floor', base: '#9a958d', marks: ['#7d7870', '#aaa59d'] },
  { id: 'wood', name: 'Wood floor', base: '#9b6b3c', marks: ['#855a31', '#ad7a47'] },
  { id: 'snow', name: 'Snow', base: '#eef1f4', marks: ['#dde3ea', '#ffffff', '#d3dae3'] },
  { id: 'lava', name: 'Lava', base: '#b5360f', marks: ['#e0631b', '#8a2408', '#f39a2b'] },
] as const;

export type TerrainId = (typeof TERRAINS)[number]['id'];

/** What a texture can be: one of the built-in ones, or a picture of an asset pack (`pack:<id>:<path>`). */
export type TerrainRef = TerrainId | `pack:${string}`;

export const isPackTexture = (ref: string): ref is `pack:${string}` => ref.startsWith('pack:');

export const isTerrain = (v: unknown): v is TerrainId => TERRAINS.some((t) => t.id === v);

/** A small fast random generator, seeded (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Size of a tile in map pixels. */
export const TERRAIN_TILE = 256;

const tiles = new Map<TerrainId, HTMLCanvasElement>();

/** The tile for a terrain, drawn once. Marks near an edge are drawn again on the other side. */
export function terrainTile(id: TerrainId): HTMLCanvasElement {
  const cached = tiles.get(id);
  if (cached) return cached;
  const def = TERRAINS.find((t) => t.id === id) ?? TERRAINS[0];
  const size = TERRAIN_TILE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const random = seeded(id.length * 7919 + (id.charCodeAt(0) || 1));
  const pick = () => def.marks[Math.floor(random() * def.marks.length)] ?? def.base;
  ctx.fillStyle = def.base;
  ctx.fillRect(0, 0, size, size);
  /** Draws a mark at (x, y) and its copies across the edges, so the tile repeats seamlessly. */
  const wrap = (x: number, y: number, r: number, draw: (x: number, y: number) => void) => {
    for (const dx of [-size, 0, size])
      for (const dy of [-size, 0, size]) {
        const cx = x + dx;
        const cy = y + dy;
        if (cx + r >= 0 && cx - r <= size && cy + r >= 0 && cy - r <= size) draw(cx, cy);
      }
  };
  switch (id) {
    case 'grass':
      for (let i = 0; i < 900; i++) {
        const x = random() * size;
        const y = random() * size;
        const h = 4 + random() * 7;
        const lean = (random() - 0.5) * 4;
        ctx.strokeStyle = pick();
        ctx.lineWidth = 1.2;
        wrap(x, y, h, (cx, cy) => {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + lean, cy - h);
          ctx.stroke();
        });
      }
      break;
    case 'water':
      ctx.lineWidth = 2;
      for (let i = 0; i < 70; i++) {
        const x = random() * size;
        const y = random() * size;
        const w = 12 + random() * 22;
        ctx.strokeStyle = pick();
        wrap(x, y, w, (cx, cy) => {
          ctx.beginPath();
          ctx.moveTo(cx - w / 2, cy);
          ctx.quadraticCurveTo(cx - w / 4, cy - 4, cx, cy);
          ctx.quadraticCurveTo(cx + w / 4, cy + 4, cx + w / 2, cy);
          ctx.stroke();
        });
      }
      break;
    case 'stone':
    case 'wood': {
      // Flagstones or planks: a pattern laid on the tile, lines in the darker mark.
      ctx.strokeStyle = def.marks[0];
      ctx.lineWidth = 2;
      const step = id === 'stone' ? 64 : 32;
      for (let y = 0; y < size; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + 1);
        ctx.lineTo(size, y + 1);
        ctx.stroke();
        const shift = (y / step) % 2 ? step : 0;
        const run = id === 'stone' ? step : step * 4;
        for (let x = shift; x < size; x += run) {
          ctx.beginPath();
          ctx.moveTo(x + 1, y);
          ctx.lineTo(x + 1, y + step);
          ctx.stroke();
        }
        if (id === 'wood')
          for (let i = 0; i < 6; i++) {
            ctx.strokeStyle = def.marks[1];
            ctx.lineWidth = 1;
            const gy = y + 4 + random() * (step - 8);
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(size, gy + (random() - 0.5) * 3);
            ctx.stroke();
            ctx.strokeStyle = def.marks[0];
            ctx.lineWidth = 2;
          }
      }
      break;
    }
    default: {
      // Speckles and blotches: dirt, sand, rock, snow, lava.
      const blotches = id === 'lava' ? 40 : 160;
      for (let i = 0; i < blotches; i++) {
        const x = random() * size;
        const y = random() * size;
        const r = (id === 'rock' || id === 'lava' ? 6 : 3) + random() * (id === 'lava' ? 18 : 8);
        ctx.fillStyle = pick();
        ctx.globalAlpha = 0.55;
        wrap(x, y, r, (cx, cy) => {
          ctx.beginPath();
          ctx.ellipse(cx, cy, r, r * (0.6 + random() * 0.4), random() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 1200; i++) {
        const x = random() * size;
        const y = random() * size;
        ctx.fillStyle = pick();
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }
  }
  tiles.set(id, canvas);
  return canvas;
}
