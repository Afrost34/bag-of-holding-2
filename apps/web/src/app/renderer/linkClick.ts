import { createContext } from 'react';

/**
 * What a plain click on a compendium link does where links should not navigate (a board card
 * adds the entry beside it). Ctrl/Cmd/middle-click still opens the page. Absent: links navigate.
 */
export const EntityLinkClickContext = createContext<((entityKey: string) => void) | null>(null);
