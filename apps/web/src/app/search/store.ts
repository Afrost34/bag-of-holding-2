import { create } from 'zustand';

interface SearchStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** Whether the search palette is open; any component can open it. */
export const useSearchPalette = create<SearchStore>()((set) => ({
  open: false,
  setOpen: (open) => {
    set({ open });
  },
}));
