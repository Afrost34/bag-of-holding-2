import { create } from 'zustand';
import { CAMPAIGNS_DIR } from '../campaigns/model';
import { userStore } from '../userStore';
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

/**
 * Every board, in the library and in each campaign, kept in memory and written back on
 * every change (files are small).
 */

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

const pending = new Map<string, Board>();
let writing: Promise<void> = Promise.resolve();
let loading: Promise<void> | null = null;

async function readDir(campaign?: string): Promise<Board[]> {
  const store = await userStore();
  const out: Board[] = [];
  for (const entry of await store.list(boardDir(campaign))) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
    const s = parseBoard(await store.readText(entry.path), entry.name.slice(0, -5), campaign);
    if (s) out.push(s);
  }
  return out;
}

async function readAll(): Promise<Board[]> {
  const store = await userStore();
  const campaigns = (await store.list(CAMPAIGNS_DIR)).filter((e) => e.kind === 'directory');
  const lists = await Promise.all([readDir(), ...campaigns.map((c) => readDir(c.name))]);
  return sortBoards(lists.flat());
}

const sortBoards = (list: Board[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'en'));

function writeNow(): Promise<void> {
  writing = writing
    .then(async () => {
      const batch = [...pending.values()];
      pending.clear();
      if (batch.length === 0) return;
      const store = await userStore();
      for (const s of batch) await store.writeFile(boardPath(s.id, s.campaign), serializeBoard(s));
    })
    .catch((error: unknown) => {
      console.warn('Could not save a card board', error);
    });
  return writing;
}

export const useBoards = create<BoardsStore>()((set, get) => ({
  boards: [],
  loaded: false,

  load: () => {
    loading ??= readAll()
      .then((boards) => {
        set({ boards, loaded: true });
      })
      .catch((error: unknown) => {
        console.warn('Could not load card boards', error);
        set({ loaded: true });
      });
    return loading;
  },

  reload: async () => {
    await writeNow();
    loading = null;
    await get().load();
  },

  create: async (name, campaign, contents = []) => {
    const base = newBoard(
      name,
      get().boards.map((s) => s.id),
      new Date().toISOString(),
    );
    const board = addBoardCards(campaign ? { ...base, campaign } : base, contents).board;
    const store = await userStore();
    await store.writeFile(boardPath(board.id, board.campaign), serializeBoard(board));
    set({ boards: sortBoards([...get().boards, board]) });
    return board;
  },

  save: (board) => {
    const next = { ...board, updatedAt: new Date().toISOString() };
    set({ boards: sortBoards(get().boards.map((s) => (s.id === next.id ? next : s))) });
    pending.set(next.id, next);
    void writeNow();
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
    const now = new Date().toISOString();
    const board: Board = {
      ...newBoard('Players', [], now),
      id,
      players: true,
      ...(campaign ? { campaign } : {}),
    };
    const store = await userStore();
    await store.writeFile(boardPath(id, campaign), serializeBoard(board));
    set({ boards: sortBoards([...get().boards, board]) });
    return board;
  },

  flush: writeNow,

  remove: async (id) => {
    const board = get().boards.find((s) => s.id === id);
    if (!board) return;
    pending.delete(id);
    const store = await userStore();
    await store.remove(boardPath(id, board.campaign));
    set({ boards: get().boards.filter((s) => s.id !== id) });
  },
}));

export function useBoard(id: string): Board | undefined {
  return useBoards((s) => s.boards.find((x) => x.id === id));
}

if (typeof document !== 'undefined') {
  const saveNow = () => {
    void writeNow();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
  window.addEventListener('pagehide', saveNow);
}
