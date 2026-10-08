import { create } from 'zustand';
import { docStore, inCampaign } from '../docStore';
import {
  addBoardCards,
  newBoard,
  parseBoard,
  serializeBoard,
  boardDir,
  boardPath,
  playersBoardId,
  type Board,
  type CardContent,
} from './model';

/** Every board, in the library and in each campaign (see `docStore`). */

interface BoardsStore {
  boards: Board[];
  loaded: boolean;
  load: () => Promise<void>;
  reload: () => Promise<void>;
  create: (name: string, campaign?: string, contents?: readonly CardContent[]) => Promise<Board>;
  save: (board: Board) => void;
  /** Adds cards right of what is on a board. */
  send: (boardId: string, contents: readonly CardContent[]) => void;
  /** The players' board of a campaign (or the library), made when first needed. */
  ensurePlayers: (campaign?: string) => Promise<Board>;
  flush: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useBoards = create<BoardsStore>()((set, get) => {
  const docs = docStore(
    {
      one: 'a board',
      many: 'boards',
      dir: boardDir,
      path: boardPath,
      parse: parseBoard,
      serialize: serializeBoard,
    },
    {
      get: () => get().boards,
      set: (boards, loaded) => {
        set(loaded ? { boards, loaded } : { boards });
      },
    },
  );
  return {
    boards: [],
    loaded: false,
    ...docs.actions,
    create: (name, campaign, contents = []) => {
      const base = newBoard(name, docs.ids(), new Date().toISOString());
      return docs.add(addBoardCards(inCampaign(base, campaign), contents).board);
    },
    send: (boardId, contents) => {
      const board = get().boards.find((s) => s.id === boardId);
      if (board) get().save(addBoardCards(board, contents).board);
    },
    ensurePlayers: async (campaign) => {
      if (!get().loaded) await get().load();
      const id = playersBoardId(campaign);
      const found = get().boards.find((b) => b.id === id);
      if (found) return found;
      const board: Board = {
        ...newBoard('Players', [], new Date().toISOString()),
        id,
        players: true,
      };
      return docs.add(inCampaign(board, campaign));
    },
  };
});

export function useBoard(id: string): Board | undefined {
  return useBoards((s) => s.boards.find((x) => x.id === id));
}
