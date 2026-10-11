/**
 * What a building is for: its name, how big it usually is (rooms per floor, floors, a cellar) and
 * the style it starts in. The rooms each archetype has (a tavern's common room and kitchen) are
 * its programme, used to give the planned rooms their types. Pure data.
 */

export interface Archetype {
  id: string;
  name: string;
  hint: string;
  rooms: number;
  upper: number;
  cellar: boolean;
  style: string;
  /** Ground floor, upper floors, cellar: room types, biggest room first. */
  programme: { ground: string[]; upper: string[]; cellar: string[] };
}

export const ARCHETYPES: readonly Archetype[] = [
  {
    id: 'house',
    name: 'House',
    hint: 'a family home',
    rooms: 3,
    upper: 1,
    cellar: false,
    style: 'timber',
    programme: {
      ground: ['living-room', 'kitchen', 'storage'],
      upper: ['bedroom', 'bedroom', 'study'],
      cellar: ['cellar'],
    },
  },
  {
    id: 'tavern',
    name: 'Tavern or inn',
    hint: 'common room, kitchen, guest rooms upstairs',
    rooms: 4,
    upper: 1,
    cellar: true,
    style: 'timber',
    programme: {
      ground: ['tavern', 'kitchen', 'storage', 'living-room'],
      upper: ['guest-room', 'guest-room', 'guest-room', 'bedroom'],
      cellar: ['cellar', 'storage'],
    },
  },
  {
    id: 'shop',
    name: 'Shop',
    hint: 'a shop floor, a storeroom, the owner upstairs',
    rooms: 3,
    upper: 1,
    cellar: false,
    style: 'brick',
    programme: {
      ground: ['shop', 'storage', 'workshop'],
      upper: ['bedroom', 'living-room', 'kitchen'],
      cellar: ['cellar'],
    },
  },
  {
    id: 'smithy',
    name: 'Smithy',
    hint: 'a forge, a store, a room above',
    rooms: 2,
    upper: 0,
    cellar: false,
    style: 'stone',
    programme: {
      ground: ['smithy', 'storage', 'workshop'],
      upper: ['bedroom'],
      cellar: ['cellar'],
    },
  },
  {
    id: 'warehouse',
    name: 'Warehouse',
    hint: 'storerooms and an office',
    rooms: 3,
    upper: 0,
    cellar: true,
    style: 'brick',
    programme: {
      ground: ['storage', 'storage', 'study'],
      upper: ['storage'],
      cellar: ['cellar', 'storage'],
    },
  },
  {
    id: 'farmhouse',
    name: 'Mill or farmhouse',
    hint: 'a kitchen hall, a storeroom, bedrooms',
    rooms: 3,
    upper: 1,
    cellar: true,
    style: 'shack',
    programme: {
      ground: ['kitchen', 'storage', 'workshop'],
      upper: ['bedroom', 'bedroom'],
      cellar: ['cellar'],
    },
  },
  {
    id: 'temple',
    name: 'Temple',
    hint: 'a nave, a shrine, the priests’ rooms',
    rooms: 3,
    upper: 0,
    cellar: true,
    style: 'stone',
    programme: {
      ground: ['temple', 'shrine', 'study'],
      upper: ['bedroom', 'study'],
      cellar: ['crypt'],
    },
  },
  {
    id: 'manor',
    name: 'Manor',
    hint: 'a hall, a library, many bedrooms',
    rooms: 6,
    upper: 1,
    cellar: true,
    style: 'brick',
    programme: {
      ground: ['living-room', 'study', 'kitchen', 'tavern', 'storage', 'shrine'],
      upper: ['bedroom', 'bedroom', 'bedroom', 'guest-room', 'study', 'living-room'],
      cellar: ['cellar', 'storage'],
    },
  },
  {
    id: 'guildhall',
    name: 'Guildhall',
    hint: 'a meeting hall, offices, a store',
    rooms: 5,
    upper: 1,
    cellar: false,
    style: 'stone',
    programme: {
      ground: ['tavern', 'study', 'storage', 'shop', 'kitchen'],
      upper: ['study', 'study', 'living-room', 'guest-room'],
      cellar: ['storage'],
    },
  },
  {
    id: 'tower',
    name: 'Tower',
    hint: 'one room a floor, stacked high',
    rooms: 1,
    upper: 3,
    cellar: true,
    style: 'stone',
    programme: {
      ground: ['guardhouse'],
      upper: ['study', 'wizard-lab', 'bedroom'],
      cellar: ['storage'],
    },
  },
  {
    id: 'barracks',
    name: 'Barracks',
    hint: 'dormitories, an armory, a mess',
    rooms: 4,
    upper: 1,
    cellar: false,
    style: 'stone',
    programme: {
      ground: ['tavern', 'armory', 'guardhouse', 'kitchen'],
      upper: ['barracks', 'barracks', 'storage'],
      cellar: ['prison'],
    },
  },
  {
    id: 'keep',
    name: 'Keep',
    hint: 'a great hall, a throne room, cells below',
    rooms: 5,
    upper: 2,
    cellar: true,
    style: 'stone',
    programme: {
      ground: ['tavern', 'kitchen', 'armory', 'guardhouse', 'storage'],
      upper: ['throne-room', 'bedroom', 'study', 'barracks'],
      cellar: ['prison', 'storage', 'cellar'],
    },
  },
  // Rust & Sunfire: the tower-top platform cities
  {
    id: 'foundry',
    name: 'Refinery or foundry',
    hint: 'crucibles and forges, tanks and pipes',
    rooms: 4,
    upper: 1,
    cellar: false,
    style: 'rust',
    programme: {
      ground: ['foundry', 'refinery', 'storage', 'workshop'],
      upper: ['refinery', 'storage', 'study'],
      cellar: ['storage'],
    },
  },
  {
    id: 'shanty',
    name: 'Shanty stack',
    hint: 'small rooms stacked up, bedrolls and crates',
    rooms: 4,
    upper: 2,
    cellar: false,
    style: 'rust',
    programme: {
      ground: ['shanty', 'kitchen', 'shanty', 'storage'],
      upper: ['shanty', 'shanty', 'shanty', 'storage'],
      cellar: ['storage'],
    },
  },
  {
    id: 'winch',
    name: 'Winch or lift station',
    hint: 'the winch house, a guard post, cargo',
    rooms: 3,
    upper: 1,
    cellar: false,
    style: 'rust',
    programme: {
      ground: ['winch-room', 'storage', 'guardhouse'],
      upper: ['winch-room', 'study'],
      cellar: ['storage'],
    },
  },
  {
    id: 'arena',
    name: 'Arena',
    hint: 'a fighting pit, the armoury, cells below',
    rooms: 3,
    upper: 0,
    cellar: true,
    style: 'rust',
    programme: {
      ground: ['arena-floor', 'armory', 'barracks'],
      upper: ['barracks', 'storage'],
      cellar: ['prison', 'storage'],
    },
  },
  {
    id: 'chapel',
    name: 'Chapel',
    hint: 'built round a beam: an altar, pews, a shrine',
    rooms: 2,
    upper: 0,
    cellar: false,
    style: 'heliark',
    programme: {
      ground: ['chapel', 'shrine'],
      upper: ['study'],
      cellar: ['crypt'],
    },
  },
];

const FIRST = ARCHETYPES[0];
if (!FIRST) throw new Error('No building archetypes');

export const archetypeById = (id: string): Archetype =>
  ARCHETYPES.find((a) => a.id === id) ?? FIRST;
