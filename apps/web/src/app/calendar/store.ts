import { create } from 'zustand';
import { campaignDir } from '../campaigns/model';
import { userStore } from '../userStore';
import { CALENDAR_FILE, parseCalendar, serializeCalendar, type Calendar } from './model';

/** The calendar of the campaign on screen, written back on every change. */

interface CalendarStore {
  campaignId: string | null;
  calendar: Calendar | null;
  loaded: boolean;
  load: (campaignId: string) => Promise<void>;
  /** Reads the file again (after a sync). */
  reload: () => Promise<void>;
  save: (calendar: Calendar) => void;
}

const calendarPath = (campaignId: string) => `${campaignDir(campaignId)}/${CALENDAR_FILE}`;
let writing: Promise<void> = Promise.resolve();

async function read(campaignId: string): Promise<Calendar | null> {
  const store = await userStore();
  return parseCalendar(await store.readText(calendarPath(campaignId)));
}

export const useCalendar = create<CalendarStore>()((set, get) => ({
  campaignId: null,
  calendar: null,
  loaded: false,

  load: async (campaignId) => {
    if (get().campaignId === campaignId && get().loaded) return;
    set({ campaignId, calendar: null, loaded: false });
    const calendar = await read(campaignId);
    if (get().campaignId === campaignId) set({ calendar, loaded: true });
  },

  reload: async () => {
    const id = get().campaignId;
    if (!id) return;
    const calendar = await read(id);
    if (get().campaignId === id) set({ calendar, loaded: true });
  },

  save: (calendar) => {
    const id = get().campaignId;
    if (!id) return;
    set({ calendar });
    writing = writing
      .then(async () => {
        const store = await userStore();
        await store.writeFile(calendarPath(id), serializeCalendar(calendar));
      })
      .catch((error: unknown) => {
        console.warn('Could not save the calendar', error);
      });
  },
}));
