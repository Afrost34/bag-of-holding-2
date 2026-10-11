import { create } from 'zustand';

interface FocusMode {
  /** The tab fills the app window: no sidebar and no tab strip, only the page's own tools. */
  on: boolean;
  toggle: () => void;
  set: (on: boolean) => void;
}

/** "Full screen" inside the app (the window's title bar stays). Not remembered: a new start shows the app. */
export const useFocusMode = create<FocusMode>((set) => ({
  on: false,
  toggle: () => {
    set((s) => ({ on: !s.on }));
  },
  set: (on) => {
    set({ on });
  },
}));
