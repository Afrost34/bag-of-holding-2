/**
 * A quick NPC for the table: a name, who they are, how they look and talk, what they want. The
 * word lists are the app's own (not 5etools text), so a generated NPC is the DM's to keep.
 */

export interface Npc {
  name: string;
  species: string;
  gender: string;
  age: string;
  occupation: string;
  appearance: string;
  personality: string;
  voice: string;
  wants: string;
  secret: string;
}

type Rng = () => number;

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)] as T;

/** Name parts by species: a first syllable, a middle one (sometimes), an ending by gender. */
const SYLLABLES: Record<
  string,
  { start: string[]; middle: string[]; end: [string[], string[]]; family?: string[] }
> = {
  Human: {
    start: [
      'Al',
      'Bran',
      'Cal',
      'Dar',
      'Ed',
      'Gar',
      'Hal',
      'Jor',
      'Mar',
      'Ros',
      'Sel',
      'Tam',
      'Wil',
    ],
    middle: ['', '', 'a', 'e', 'i', 'o'],
    end: [
      ['ric', 'den', 'win', 'mund', 'ton', 'as'],
      ['a', 'ine', 'ella', 'wyn', 'is', 'ey'],
    ],
    family: ['Ashford', 'Blackwood', 'Carrow', 'Dunmore', 'Fairweather', 'Hale', 'Marsh', 'Thorne'],
  },
  Elf: {
    start: ['Ae', 'Cael', 'El', 'Fae', 'Gal', 'Ith', 'Lae', 'Mir', 'Syl', 'Thal', 'Vae'],
    middle: ['', 'a', 'e', 'i', 'la', 'ri'],
    end: [
      ['ndor', 'rian', 'thas', 'vir', 'lis'],
      ['wyn', 'riel', 'thia', 'lara', 'ndra'],
    ],
    family: ['Amakiir', 'Galanodel', 'Liadon', 'Meliamne', 'Siannodel', 'Xiloscient'],
  },
  Dwarf: {
    start: ['Bar', 'Dol', 'Dur', 'Gim', 'Har', 'Kil', 'Mor', 'Orn', 'Thor', 'Brom'],
    middle: ['', '', 'a', 'i', 'u'],
    end: [
      ['ak', 'in', 'rik', 'grim', 'dain'],
      ['dis', 'hild', 'ra', 'unn', 'wyn'],
    ],
    family: ['Battlehammer', 'Fireforge', 'Gorunn', 'Holderhek', 'Ironfist', 'Stonebeard'],
  },
  Halfling: {
    start: ['Bel', 'Cor', 'Fin', 'Mer', 'Per', 'Pip', 'Ros', 'Wel', 'Lid', 'Mil'],
    middle: ['', '', 'a', 'i', 'o'],
    end: [
      ['ric', 'do', 'nan', 'by', 'ton'],
      ['ie', 'la', 'ly', 'ri', 'sy'],
    ],
    family: ['Brushgather', 'Goodbarrel', 'Greenbottle', 'Tealeaf', 'Thorngage', 'Underbough'],
  },
  Gnome: {
    start: ['Al', 'Bim', 'Dim', 'Fon', 'Gim', 'Nim', 'Orr', 'Sin', 'Wren', 'Zook'],
    middle: ['', 'ble', 'li', 'ni', 'po'],
    end: [
      ['ble', 'bin', 'kin', 'nock', 'ston'],
      ['bi', 'ella', 'na', 'wick', 'ra'],
    ],
    family: ['Beren', 'Daergel', 'Folkor', 'Garrick', 'Nackle', 'Timbers', 'Turen'],
  },
  Orc: {
    start: ['Dench', 'Gor', 'Hol', 'Kru', 'Mog', 'Rag', 'Shum', 'Thok', 'Ug', 'Yev'],
    middle: ['', '', 'a', 'o', 'u'],
    end: [
      ['ash', 'ar', 'gar', 'mak', 'tusk'],
      ['ga', 'ka', 'ra', 'sha', 'ul'],
    ],
  },
  Tiefling: {
    start: ['Ak', 'Bar', 'Dam', 'Kal', 'Lev', 'Mor', 'Nem', 'Ori', 'Ska', 'Zar'],
    middle: ['', 'a', 'e', 'i', 'ka'],
    end: [
      ['akos', 'thos', 'mon', 'ius', 'zar'],
      ['kis', 'ria', 'theia', 'lith', 'ka'],
    ],
  },
  Dragonborn: {
    start: ['Ar', 'Bala', 'Don', 'Gha', 'Kri', 'Med', 'Nad', 'Pand', 'Sora', 'Tor'],
    middle: ['', 'a', 'i', 'ja', 'ra'],
    end: [
      ['ash', 'dar', 'jhan', 'nar', 'rinn'],
      ['ra', 'shann', 'thra', 'vys', 'zil'],
    ],
  },
};

const GENDERS = ['woman', 'man', 'woman', 'man', 'person'] as const;
const AGES = ['young', 'young adult', 'in their prime', 'middle-aged', 'old', 'very old'];
const OCCUPATIONS = [
  'innkeeper',
  'blacksmith',
  'merchant',
  'guard',
  'priest',
  'farmer',
  'scholar',
  'sailor',
  'thief',
  'noble',
  'hunter',
  'healer',
  'bard',
  'miner',
  'courier',
  'fortune teller',
  'stablehand',
  'tax collector',
  'alchemist',
  'retired adventurer',
];
const APPEARANCE = [
  'a scar across the chin',
  'ink-stained fingers',
  'missing two teeth',
  'bright, mismatched clothes',
  'a nervous twitch',
  'braided beard or hair',
  'very tall and stooped',
  'a booming laugh',
  'a jeweled earring',
  'smells of smoke',
  'piercing pale eyes',
  'a limp and a cane',
  'freckles everywhere',
  'immaculately dressed',
  'tattooed hands',
  'always eating something',
];
const PERSONALITY = [
  'friendly to a fault',
  'suspicious of strangers',
  'loud and boastful',
  'shy but curious',
  'blunt and honest',
  'flatters everyone',
  'quick to anger',
  'endlessly patient',
  'gossips',
  'pious',
  'greedy',
  'brave',
  'superstitious',
  'sarcastic',
  'kind to animals',
  'bored of it all',
];
const VOICES = [
  'speaks very slowly',
  'whispers',
  'rhymes when nervous',
  'uses big words wrongly',
  'hums between sentences',
  'talks with their hands',
  'a thick regional accent',
  'refers to themself by name',
  'clears their throat a lot',
  'speaks in short sentences',
];
const WANTS = [
  'to pay off a debt',
  'to find a missing sibling',
  'revenge on a rival',
  'to leave this town',
  'a quiet life',
  'fame',
  'to protect their family',
  'a rare ingredient',
  'to be taken seriously',
  'forgiveness',
  'a map to a ruin',
  'to win back a lost love',
];
const SECRETS = [
  'is a spy for a nearby lord',
  'owes money to dangerous people',
  'once was an adventurer',
  'saw something they should not have',
  'is not who they claim to be',
  'hides a stolen relic',
  'secretly worships a forbidden god',
  'is plotting to leave without paying',
  'knows a hidden path',
  'is related to the villain',
  'has a cursed item',
  'has no secret at all',
];

export const NPC_SPECIES = Object.keys(SYLLABLES);

export function npcName(species: string, gender: string, rng: Rng = Math.random): string {
  const s = SYLLABLES[species] ?? SYLLABLES.Human;
  if (!s) return 'Nameless';
  const ending = gender === 'woman' ? s.end[1] : gender === 'man' ? s.end[0] : pick(s.end, rng);
  const first = `${pick(s.start, rng)}${pick(s.middle, rng)}${pick(ending, rng)}`;
  return s.family ? `${first} ${pick(s.family, rng)}` : first;
}

/** A new NPC; `species` keeps one, otherwise any. */
export function generateNpc(rng: Rng = Math.random, species?: string): Npc {
  const sp = species && SYLLABLES[species] ? species : pick(NPC_SPECIES, rng);
  const gender = pick(GENDERS, rng);
  return {
    name: npcName(sp, gender, rng),
    species: sp,
    gender,
    age: pick(AGES, rng),
    occupation: pick(OCCUPATIONS, rng),
    appearance: pick(APPEARANCE, rng),
    personality: pick(PERSONALITY, rng),
    voice: pick(VOICES, rng),
    wants: pick(WANTS, rng),
    secret: pick(SECRETS, rng),
  };
}
