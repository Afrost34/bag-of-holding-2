import type { Wanted } from '../packDefaults';

/**
 * Line kits: things laid along a line, made of a deck strip down the middle, rail strips to both
 * sides and posts every few squares. The walkways of Rust & Sunfire's platform cities
 * (chainwalks, cable bridges, scaffolds, catwalks), pipe runs, colonnades and railings. The
 * pictures are Forgotten Adventures strips (`_Path`) and stamps, asked for by `Wanted` queries in
 * order of preference; `catalog.test.ts` checks them on real names. Lengths are in pack squares.
 * Pure data.
 */

export interface KitStrip {
  want: Wanted[];
  /** Across the line, in squares. */
  width: number;
  /** Drawn without packs: a line of this colour. */
  color: string;
}

export interface Kit {
  id: string;
  name: string;
  hint: string;
  /** Down the middle. */
  deck?: KitStrip;
  /** To both sides, this far from the middle (squares). */
  rail?: KitStrip & { offset: number };
  /**
   * A post every `every` squares, `offset` to both sides (0: on the middle line), `size` times its
   * own, turned `turn` degrees from the line. `fill`: pieces laid end to end, each centred in its
   * `every` squares (a stair run), instead of posts at the stops.
   */
  post?: {
    want: Wanted[];
    every: number;
    offset: number;
    size?: number;
    turn?: number;
    fill?: boolean;
  };
}

/** A strip (`_Path`) whose name has one of these words. */
const strip = (...words: string[]): Wanted => ({
  cats: ['paths', 'walls'],
  anyWords: words,
  not: ['ribbon', 'broken'],
});
const stamp = (cats: Wanted['cats'], ...words: string[]): Wanted => ({
  cats,
  anyWords: words,
  not: ['broken', 'fallen', 'ruin'],
});

const CHAIN = [strip('torment_chain_a_path'), strip('torment_chain')];
const WOOD_DECK = [strip('walkway_small_wood_ashen'), strip('walkway_small_wood')];
const WOOD_POST = [
  stamp(['buildings'], '/pillars/wood/pillar_wood_ashen'),
  stamp(['buildings'], '/pillars/wood/'),
];
const METAL_POST = [stamp(['buildings'], '/pillars/metal/'), ...WOOD_POST];

export const KITS: readonly Kit[] = [
  {
    id: 'chainwalk',
    name: 'Chainwalk',
    hint: 'a grating deck slung on chains, posts every few squares',
    deck: {
      want: [strip('floor_grate_line_metal_rusty'), strip('floor_grate_line')],
      width: 1,
      color: '#6b5a4a',
    },
    rail: { want: CHAIN, width: 0.25, offset: 0.55, color: '#3a3a3a' },
    post: { want: METAL_POST, every: 3, offset: 0.55, size: 0.45 },
  },
  {
    id: 'cable-bridge',
    name: 'Cable bridge',
    hint: 'planks between two chains, posts at the ends',
    deck: { want: WOOD_DECK, width: 1.2, color: '#8a6a45' },
    rail: { want: CHAIN, width: 0.25, offset: 0.65, color: '#3a3a3a' },
    post: { want: WOOD_POST, every: 5, offset: 0.65, size: 0.6 },
  },
  {
    id: 'scaffold',
    name: 'Scaffold',
    hint: 'a wide plank deck, wooden railings, a post every two squares',
    deck: { want: WOOD_DECK, width: 2, color: '#8a6a45' },
    rail: {
      want: [strip('shack_wall_wood_a_ashen_railing'), strip('_railing_')],
      width: 0.35,
      offset: 1.05,
      color: '#5a4630',
    },
    post: { want: WOOD_POST, every: 2, offset: 1.05, size: 0.5 },
  },
  {
    id: 'catwalk',
    name: 'Metal catwalk',
    hint: 'a grating deck with metal railings',
    deck: {
      want: [strip('floor_grate_line_metal_gray'), strip('floor_grate_line')],
      width: 1,
      color: '#5e5e5e',
    },
    rail: {
      want: [strip('railing_metal_rusty'), strip('railing_metal')],
      width: 0.3,
      offset: 0.6,
      color: '#3a3a3a',
    },
  },
  {
    id: 'pipe',
    name: 'Pipe run',
    hint: 'a large pipe with flanges every few squares',
    deck: {
      want: [strip('pipe_metal_rusty_large'), strip('pipe_metal_')],
      width: 1,
      color: '#6a4a3a',
    },
    post: { want: [stamp(['buildings'], 'flange_metal_rusty_large')], every: 3, offset: 0 },
  },
  {
    id: 'small-pipe',
    name: 'Small pipes',
    hint: 'a thin pipe along a wall or floor',
    deck: {
      want: [strip('pipe_metal_rusty_small'), strip('pipe_metal_')],
      width: 0.5,
      color: '#6a4a3a',
    },
  },
  {
    id: 'railing',
    name: 'Railing',
    hint: 'a metal railing along a platform edge',
    deck: {
      want: [strip('railing_metal_rusty'), strip('railing_metal')],
      width: 0.3,
      color: '#3a3a3a',
    },
  },
  {
    id: 'colonnade',
    name: 'Colonnade',
    hint: 'pillars to both sides, every two squares',
    post: {
      want: [
        stamp(['buildings'], '/pillars/stone/pillar_stone_'),
        stamp(['buildings'], '/pillars/'),
      ],
      every: 2,
      offset: 1.5,
      size: 1.6,
    },
  },
  {
    id: 'pillar-row',
    name: 'Pillar row',
    hint: 'one line of pillars, every three squares',
    post: {
      want: [
        stamp(['buildings'], '/pillars/stone/pillar_stone_'),
        stamp(['buildings'], '/pillars/'),
      ],
      every: 3,
      offset: 0,
      size: 1.6,
    },
  },
  {
    id: 'braziers',
    name: 'Brazier row',
    hint: 'lit braziers to both sides of a hall, every four squares',
    post: {
      want: [stamp(['lights'], '/braziers/lit/brazier_metal'), stamp(['lights'], '/braziers/lit/')],
      every: 4,
      offset: 2,
      size: 0.6,
    },
  },
  {
    id: 'stairs',
    name: 'Stair run',
    hint: 'flights of stairs end to end, as long as the line',
    post: {
      want: [
        stamp(['buildings'], '/stairs_stone/stairs_stone_'),
        stamp(['buildings'], '/stairs_and_ladders/stairs_'),
      ],
      every: 3,
      offset: 0,
      turn: 90,
      fill: true,
    },
  },
];

const FIRST = KITS[0];
if (!FIRST) throw new Error('No kits');

export const kitById = (id: string): Kit => KITS.find((k) => k.id === id) ?? FIRST;
