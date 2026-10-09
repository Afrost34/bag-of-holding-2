import { secureRng, type Rng } from '@boh/dice';
import { crOf } from '@boh/rules';
import { newId } from '../cards/model';

/**
 * The combat tracker: who is fighting, in initiative order, with hit points, conditions,
 * concentration and legendary actions. It lives on a board as a card.
 *
 * A monster is stored by its entity key (its name is looked up when shown, never copied), a
 * character by its id; their numbers (AC, hit points, initiative bonus) are copied when combat
 * starts because they change during the fight.
 */

export const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated',
  'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned',
  'Unconscious',
] as const; // prettier-ignore

export interface Combatant {
  id: string;
  /** A monster's entity key. */
  key?: string;
  /** A character's id. */
  character?: string;
  /** Shown name for characters and anything added by hand. */
  name?: string;
  /** "Goblin 2": the number among creatures of the same kind. */
  n?: number;
  initiative: number;
  initBonus: number;
  hp: number;
  maxHp: number;
  tempHp?: number;
  ac: number;
  conditions: string[];
  concentration?: boolean;
  /** Legendary actions per round, and how many are spent. */
  legendary?: { max: number; used: number };
  /** Has lair actions (a legendary group): adds the lair's turn at initiative 20. */
  lair?: boolean;
}

export interface CombatState {
  combatants: Combatant[];
  /** Whose turn it is: a combatant's id, LAIR, or null before the first turn. */
  turn: string | null;
  round: number;
}

/** The lair's place in the turn order (initiative 20, losing ties). */
export const LAIR = 'lair';

/** Highest initiative first; ties go to the higher bonus, then keep their order. */
export function sortCombatants(list: readonly Combatant[]): Combatant[] {
  return [...list].sort((a, b) => b.initiative - a.initiative || b.initBonus - a.initBonus);
}

/** Turn order: the combatants, with the lair's turn at 20 when a creature has a lair. */
export function turnOrder(combatants: readonly Combatant[]): string[] {
  const sorted = sortCombatants(combatants);
  const ids = sorted.map((c) => c.id);
  if (!combatants.some((c) => c.lair)) return ids;
  const at = sorted.findIndex((c) => c.initiative < 20);
  ids.splice(at < 0 ? ids.length : at, 0, LAIR);
  return ids;
}

/** The next turn; past the last a new round starts. A creature's legendary actions come back
 * at the start of its turn. */
export function advanceTurn(state: CombatState): CombatState {
  const order = turnOrder(state.combatants);
  if (order.length === 0) return state;
  const at = state.turn === null ? -1 : order.indexOf(state.turn);
  const nextIndex = at + 1;
  const wraps = nextIndex >= order.length;
  const turn = order[wraps ? 0 : nextIndex] ?? null;
  return {
    combatants: state.combatants.map((c) =>
      c.id === turn && c.legendary ? { ...c, legendary: { ...c.legendary, used: 0 } } : c,
    ),
    turn,
    round: state.turn === null ? Math.max(1, state.round) : wraps ? state.round + 1 : state.round,
  };
}

/** The previous turn (to undo a click). */
export function previousTurn(state: CombatState): CombatState {
  const order = turnOrder(state.combatants);
  if (order.length === 0 || state.turn === null) return state;
  const at = order.indexOf(state.turn);
  if (at <= 0)
    return state.round <= 1
      ? { ...state, turn: null }
      : { ...state, turn: order.at(-1) ?? null, round: state.round - 1 };
  return { ...state, turn: order[at - 1] ?? null };
}

/** Damage (negative) comes off temporary hit points first; healing (positive) stops at max. */
export function changeHp(c: Combatant, amount: number): Combatant {
  if (amount >= 0) return { ...c, hp: Math.min(c.maxHp, c.hp + amount) };
  let damage = -amount;
  const temp = c.tempHp ?? 0;
  const fromTemp = Math.min(temp, damage);
  damage -= fromTemp;
  const { tempHp: _t, ...rest } = c;
  const left = temp - fromTemp;
  return { ...rest, ...(left > 0 ? { tempHp: left } : {}), hp: Math.max(0, c.hp - damage) };
}

const mod = (score: unknown) => (typeof score === 'number' ? Math.floor((score - 10) / 2) : 0);

function proficiencyForCr(cr: string | undefined): number {
  const v = cr === undefined ? 0 : cr.includes('/') ? 0 : Number(cr);
  if (!Number.isFinite(v) || v < 5) return 2;
  return Math.min(9, 2 + Math.ceil((v - 4) / 4));
}

/** A monster's numbers, read from its 5etools entry. */
export function monsterStats(data: Record<string, unknown>): {
  ac: number;
  hp: number;
  initBonus: number;
  legendary?: number;
  lair: boolean;
} {
  const acList = Array.isArray(data.ac) ? (data.ac as unknown[]) : [];
  const first = acList[0];
  const ac =
    typeof first === 'number'
      ? first
      : typeof first === 'object' && first !== null && 'ac' in first && typeof first.ac === 'number'
        ? first.ac
        : 10;
  const hpField = data.hp;
  const hp =
    typeof hpField === 'object' &&
    hpField !== null &&
    'average' in hpField &&
    typeof hpField.average === 'number'
      ? hpField.average
      : 1;
  // 2024 monsters may add their proficiency bonus (once or twice) to initiative.
  const init = data.initiative;
  const prof =
    typeof init === 'object' &&
    init !== null &&
    'proficiency' in init &&
    typeof init.proficiency === 'number'
      ? init.proficiency
      : 0;
  const initBonus = mod(data.dex) + prof * proficiencyForCr(crOf(data.cr));
  const legendary =
    typeof data.legendaryActions === 'number'
      ? data.legendaryActions
      : Array.isArray(data.legendary)
        ? 3
        : undefined;
  return {
    ac,
    hp,
    initBonus,
    ...(legendary !== undefined ? { legendary } : {}),
    lair: typeof data.legendaryGroup === 'object' && data.legendaryGroup !== null,
  };
}

export interface MonsterInput {
  key: string;
  count: number;
  data: Record<string, unknown>;
  /** A campaign NPC's name, shown instead of the stat block's. */
  name?: string;
}

export interface CharacterInput {
  id: string;
  name: string;
  ac: number;
  hp: number;
  initBonus: number;
}

/**
 * The combatants of an encounter: each monster as many times as asked (numbered when there is
 * more than one of a kind), then the characters. Everyone's initiative is rolled.
 */
export function startCombat(
  monsters: readonly MonsterInput[],
  characters: readonly CharacterInput[],
  rng: Rng = secureRng,
): CombatState {
  const ids: string[] = [];
  const id = () => {
    const v = newId(ids);
    ids.push(v);
    return v;
  };
  const totals = new Map<string, number>();
  // Numbered per name: three Guards are Guard 1–3; an NPC is numbered apart from plain ones.
  const group = (m: MonsterInput) => m.name ?? m.key;
  for (const m of monsters) totals.set(group(m), (totals.get(group(m)) ?? 0) + m.count);
  const seen = new Map<string, number>();
  const list: Combatant[] = [];
  for (const m of monsters) {
    const s = monsterStats(m.data);
    for (let i = 0; i < m.count; i++) {
      const n = (seen.get(group(m)) ?? 0) + 1;
      seen.set(group(m), n);
      list.push({
        id: id(),
        key: m.key,
        ...(m.name ? { name: m.name } : {}),
        ...((totals.get(group(m)) ?? 0) > 1 ? { n } : {}),
        initiative: rng(20) + s.initBonus,
        initBonus: s.initBonus,
        hp: s.hp,
        maxHp: s.hp,
        ac: s.ac,
        conditions: [],
        ...(s.legendary ? { legendary: { max: s.legendary, used: 0 } } : {}),
        ...(s.lair ? { lair: true } : {}),
      });
    }
  }
  for (const c of characters)
    list.push({
      id: id(),
      character: c.id,
      name: c.name,
      initiative: rng(20) + c.initBonus,
      initBonus: c.initBonus,
      hp: c.hp,
      maxHp: c.hp,
      ac: c.ac,
      conditions: [],
    });
  return { combatants: sortCombatants(list), turn: null, round: 1 };
}

/** Adds one combatant by hand (a summoned creature, a late arrival). */
export function addCombatant(
  state: CombatState,
  c: Omit<Combatant, 'id' | 'conditions'> & { conditions?: string[] },
): CombatState {
  const combatant: Combatant = {
    conditions: [],
    ...c,
    id: newId(state.combatants.map((x) => x.id)),
  };
  return { ...state, combatants: sortCombatants([...state.combatants, combatant]) };
}

/** Removes a combatant; if it was its turn, the turn passes to the next one. */
export function removeCombatant(state: CombatState, id: string): CombatState {
  const next = state.turn === id ? advanceTurn(state) : state;
  const combatants = next.combatants.filter((c) => c.id !== id);
  return { ...next, combatants, turn: next.turn === id ? null : next.turn };
}

/** Same-kind creatures numbered 1, 2, 3 (numbers already given stay); one alone has none. */
function numberGroups(list: readonly Combatant[]): Combatant[] {
  const group = (c: Combatant) => (c.key ? (c.name ?? c.key) : null);
  const sizes = new Map<string, number>();
  for (const c of list) {
    const g = group(c);
    if (g !== null) sizes.set(g, (sizes.get(g) ?? 0) + 1);
  }
  const used = new Map<string, Set<number>>();
  for (const c of list) {
    const g = group(c);
    if (g !== null && c.n) used.set(g, (used.get(g) ?? new Set()).add(c.n));
  }
  return list.map((c) => {
    const g = group(c);
    if (g === null || (sizes.get(g) ?? 0) < 2 || c.n) return c;
    const taken = used.get(g) ?? new Set<number>();
    let n = 1;
    while (taken.has(n)) n++;
    used.set(g, taken.add(n));
    return { ...c, n };
  });
}

/**
 * Adds creatures and characters to a combat under way (or still empty): initiative rolled for
 * the newcomers, characters already fighting left out, creatures numbered with their kind.
 */
export function joinCombat(
  state: CombatState,
  monsters: readonly MonsterInput[],
  characters: readonly CharacterInput[],
  rng: Rng = secureRng,
): CombatState {
  const fighting = new Set(state.combatants.flatMap((c) => (c.character ? [c.character] : [])));
  const added = startCombat(
    monsters,
    characters.filter((c) => !fighting.has(c.id)),
    rng,
  ).combatants;
  const ids = state.combatants.map((c) => c.id);
  const fresh = added.map(({ n: _n, ...c }) => {
    const id = newId(ids);
    ids.push(id);
    return { ...c, id };
  });
  // Numbered in the order they joined: the creatures already there keep the first numbers.
  const all = numberGroups([...state.combatants, ...fresh]);
  return { ...state, combatants: sortCombatants(all) };
}
