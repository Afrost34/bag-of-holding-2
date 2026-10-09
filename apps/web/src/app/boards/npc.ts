import { BASIC_SPECIES, makeName, pick, type Rng } from './names';
import {
  AGES,
  APPEARANCE,
  ATTITUDES,
  BONDS,
  BUILDS,
  CLOTHING,
  FLAWS,
  GENDERS,
  HOOKS,
  IDEALS,
  KNOWS,
  MANNERISMS,
  OCCUPATIONS,
  PERSONALITY,
  SECRETS,
  VOICES,
  WANTS,
} from './npcWords';

/**
 * A quick NPC for the table: a name, who they are, how they look, talk and behave, what they
 * want, hide and know, and a hook for the party. The species is any of the character builder's
 * (passed in), and the name follows its naming style (see names.ts).
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
  // NPCs made before these existed lack them.
  build?: string;
  clothing?: string;
  mannerism?: string;
  ideal?: string;
  bond?: string;
  flaw?: string;
  knows?: string;
  hook?: string;
  attitude?: string;
}

/** The built-in species, for when the builder's list is not loaded. */
export const NPC_SPECIES: readonly string[] = BASIC_SPECIES;

export function npcName(species: string, gender: string, rng: Rng = Math.random): string {
  return makeName(species, gender, rng);
}

/** A new NPC; `species` keeps one, otherwise any of `pool` (the builder's species). */
export function generateNpc(
  rng: Rng = Math.random,
  species?: string,
  pool: readonly string[] = NPC_SPECIES,
): Npc {
  const sp = species ?? pick(pool.length ? pool : NPC_SPECIES, rng);
  const gender = pick(GENDERS, rng);
  return {
    name: npcName(sp, gender, rng),
    species: sp,
    gender,
    age: pick(AGES, rng),
    occupation: pick(OCCUPATIONS, rng),
    build: pick(BUILDS, rng),
    appearance: pick(APPEARANCE, rng),
    clothing: pick(CLOTHING, rng),
    personality: pick(PERSONALITY, rng),
    mannerism: pick(MANNERISMS, rng),
    voice: pick(VOICES, rng),
    ideal: pick(IDEALS, rng),
    bond: pick(BONDS, rng),
    flaw: pick(FLAWS, rng),
    wants: pick(WANTS, rng),
    secret: pick(SECRETS, rng),
    knows: pick(KNOWS, rng),
    hook: pick(HOOKS, rng),
    attitude: pick(ATTITUDES, rng),
  };
}
