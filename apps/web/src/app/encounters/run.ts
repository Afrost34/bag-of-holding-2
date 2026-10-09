import { addBoardCards, type CardContent } from '../boards/model';
import {
  startCombat,
  type CharacterInput,
  type CombatState,
  type MonsterInput,
} from '../boards/combat';
import { useBoards } from '../boards/store';
import { useCampaigns } from '../campaigns/store';
import type { CharacterFile } from '../characters/model';
import { useCharacters } from '../characters/store';
import { dataWorker } from '../data/client';
import { loadEntity } from '../data/entities';
import type { Encounter } from './model';

/**
 * Starting a fight: an encounter becomes a combat tracker, filled with its monsters and the
 * campaign's characters, on one of the campaign's boards.
 */

/** The characters of the encounter's campaign (none outside campaigns). */
export async function partyOf(encounter: Encounter): Promise<CharacterFile[]> {
  const characters = useCharacters.getState();
  if (!characters.loaded) await characters.load();
  if (!encounter.campaign) return [];
  return useCharacters.getState().characters.filter((c) => c.campaign === encounter.campaign);
}

async function characterInput(c: CharacterFile): Promise<CharacterInput | null> {
  try {
    const view = await dataWorker().character(c.decisions, { feats: c.preferences.feats });
    return {
      id: c.id,
      name: c.name,
      ac: view.sheet.ac.value,
      hp: view.sheet.hp.value,
      initBonus: view.sheet.initiative.value,
    };
  } catch (error) {
    console.warn('Could not read a character for combat', c.name, error);
    return null;
  }
}

/** Monsters with their stat blocks, ready to fight. */
export function monsterInputs(
  list: readonly { key: string; count: number; name?: string | undefined }[],
): Promise<MonsterInput[]> {
  return Promise.all(
    list.map(async (m) => {
      const e = await loadEntity(m.key);
      return {
        key: m.key,
        count: m.count,
        data: e?.data ?? {},
        ...(m.name ? { name: m.name } : {}),
      };
    }),
  );
}

/** Characters' numbers for a fight (AC, hit points, initiative), from their sheets. */
export async function characterInputs(list: readonly CharacterFile[]): Promise<CharacterInput[]> {
  const read = await Promise.all(list.map(characterInput));
  return read.filter((c): c is CharacterInput => c !== null);
}

/** The encounter's combatants, initiative rolled. */
export async function combatFor(encounter: Encounter): Promise<CombatState> {
  return startCombat(
    await monsterInputs(encounter.monsters),
    await characterInputs(await partyOf(encounter)),
  );
}

/**
 * Adds a card to a board of the encounter's campaign (the one used last, or a new one) and
 * returns where it is: the board's id and the card's.
 */
async function placeOnBoard(
  encounter: Encounter,
  content: CardContent,
): Promise<{ board: string; card: string }> {
  const boards = useBoards.getState();
  if (!boards.loaded) await boards.load();
  const mine = useBoards
    .getState()
    .boards.filter((b) => (b.campaign ?? null) === (encounter.campaign ?? null))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const target = mine[0];
  if (target) {
    const { board, ids } = addBoardCards(target, [content]);
    useBoards.getState().save(board);
    return { board: board.id, card: ids[0] ?? '' };
  }
  const campaign = useCampaigns.getState().campaigns.find((c) => c.id === encounter.campaign);
  const created = await useBoards
    .getState()
    .create(campaign ? `${campaign.name} board` : 'Board', encounter.campaign, [content]);
  return { board: created.id, card: created.cards[0]?.id ?? '' };
}

/** Starts the fight: the encounter's combat tracker, filled, on a board of its campaign. */
export async function runOnBoard(encounter: Encounter): Promise<{ board: string; card: string }> {
  const state = await combatFor(encounter);
  return placeOnBoard(encounter, { kind: 'combat', encounter: encounter.id, ...state });
}

/** Puts the encounter itself on a board (to start the fight from there later). */
export function putOnBoard(encounter: Encounter): Promise<{ board: string; card: string }> {
  return placeOnBoard(encounter, { kind: 'encounter', encounter: encounter.id });
}
