import type { RollMode } from '@boh/dice';
import type { RollSpec } from '@boh/renderer';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { clear3dDice, show3dDice } from './dice3d';
import { needsFor, rollSpec, type InputNeeds, type RollEntry, type RollInputs } from './roll';

/** Per-device dice preferences. */
interface DiceSettings {
  threeD: boolean;
  setThreeD: (on: boolean) => void;
}

export const useDiceSettings = create<DiceSettings>()(
  persist(
    (set) => ({
      threeD: true,
      setThreeD: (threeD) => {
        set({ threeD });
      },
    }),
    { name: 'boh.dice', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export interface PendingRoll {
  spec: RollSpec;
  mode: RollMode;
  needs: InputNeeds;
}

interface DiceStore {
  /** This session's rolls, newest first. Kept until the tab/app is closed. */
  log: RollEntry[];
  /** Ids of results currently shown as cards. */
  shown: string[];
  /** A roll waiting for the user to provide values (slot level, prompts). */
  pending: PendingRoll | null;
  rolling: boolean;

  /** Rolls and records; resolves to the result (undefined when it waits for inputs or fails). */
  roll: (spec: RollSpec, mode?: RollMode, inputs?: RollInputs) => Promise<RollEntry | undefined>;
  submitPending: (inputs: RollInputs) => Promise<void>;
  cancelPending: () => void;
  dismiss: (id: string) => void;
  clearLog: () => void;
}

const MAX_LOG = 300;
const MAX_SHOWN = 4;
const SHOW_FOR_MS = 9000;

export const useDice = create<DiceStore>()(
  persist(
    (set, get) => ({
      log: [],
      shown: [],
      pending: null,
      rolling: false,

      roll: async (spec, mode = 'normal', inputs = {}) => {
        const needs = needsFor(spec, inputs);
        if (needs) {
          set({ pending: { spec, mode, needs } });
          return undefined;
        }
        let entry: RollEntry;
        try {
          entry = rollSpec(spec, mode, inputs);
        } catch (error) {
          console.warn('Could not roll', spec.expression, error);
          return undefined;
        }
        if (useDiceSettings.getState().threeD) {
          set({ rolling: true });
          await show3dDice(entry.terms);
          set({ rolling: false });
        }
        set((s) => ({
          log: [entry, ...s.log].slice(0, MAX_LOG),
          shown: [entry.id, ...s.shown].slice(0, MAX_SHOWN),
        }));
        setTimeout(() => {
          get().dismiss(entry.id);
        }, SHOW_FOR_MS);
        return entry;
      },

      submitPending: async (inputs) => {
        const pending = get().pending;
        if (!pending) return;
        set({ pending: null });
        await get().roll(pending.spec, pending.mode, inputs);
      },

      cancelPending: () => {
        set({ pending: null });
      },

      dismiss: (id) => {
        set((s) => ({ shown: s.shown.filter((x) => x !== id) }));
        if (get().shown.length === 0) clear3dDice();
      },

      clearLog: () => {
        set({ log: [], shown: [] });
      },
    }),
    {
      // The log lasts the session (the user asked for "this session only").
      name: 'boh.dice.log',
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ log: s.log }),
    },
  ),
);
