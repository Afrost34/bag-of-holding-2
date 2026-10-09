/** What can be added to a board, shared by the tool bar's Add menu and the right-click menu. */
import '@xyflow/react/dist/style.css';
import { type Board, type CardContent } from '../../app/boards/model';
import { generateNames } from '../../app/boards/names';
import { generateNpc } from '../../app/boards/npc';
import { useSpeciesNames } from '../../app/boards/useSpeciesNames';
import { useJournal } from '../../app/journal/store';
import { shrinkImage } from '../../app/shrinkImage';
import { type KIND_ICONS, KIND_LABELS } from './kinds';

export type PanelKind = 'entity' | 'note' | 'map' | 'character';

export const PANEL_TITLES: Record<PanelKind, string> = {
  entity: 'Add from the compendium',
  note: 'Add a journal note',
  map: 'Add a map',
  character: 'Add a character',
};

/** One thing the Add menus offer. */
export interface AddOption {
  id: string;
  label: string;
  kind: keyof typeof KIND_ICONS;
  disabled?: boolean;
  /** Picks, then adds (`at`: where the board was right-clicked). */
  run: (at?: { x: number; y: number }) => void;
  /** Starts a new group in the menu. */
  separator?: boolean;
}

/** What can be added to a board: the toolbar's Add menu and the right-click menu share it. */
export function useAddOptions(
  board: Board,
  add: (contents: CardContent[], at?: { x: number; y: number }) => void,
  openPanel: (kind: PanelKind, at?: { x: number; y: number }) => void,
): AddOption[] {
  const addAttachment = useJournal((s) => s.addAttachment);
  const journalFor = useJournal((s) => s.campaignId);
  const species = useSpeciesNames();
  const pickPicture = (at?: { x: number; y: number }) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void (async () => {
        // A campaign's pictures go with its journal files, full size; others are kept smaller.
        const src =
          board.campaign && journalFor === board.campaign
            ? `journal:${await addAttachment(file.name, new Uint8Array(await file.arrayBuffer()))}`
            : await shrinkImage(file, 1600);
        add([{ kind: 'image', src }], at);
      })();
    };
    input.click();
  };
  const simple = (id: string, kind: AddOption['kind'], content: () => CardContent): AddOption => ({
    id,
    label: KIND_LABELS[kind],
    kind,
    run: (at) => {
      add([content()], at);
    },
  });
  return [
    {
      id: 'entity',
      label: 'Compendium entry…',
      kind: 'entity',
      run: (at) => {
        openPanel('entity', at);
      },
    },
    {
      id: 'note',
      label: 'Journal note…',
      kind: 'note',
      disabled: !board.campaign,
      run: (at) => {
        openPanel('note', at);
      },
    },
    { id: 'image', label: 'Picture…', kind: 'image', run: pickPicture },
    {
      id: 'map',
      label: 'Map…',
      kind: 'map',
      run: (at) => {
        openPanel('map', at);
      },
    },
    {
      id: 'character',
      label: 'Character…',
      kind: 'character',
      run: (at) => {
        openPanel('character', at);
      },
    },
    { ...simple('calendar', 'calendar', () => ({ kind: 'calendar' })), disabled: !board.campaign },
    {
      ...simple('npc', 'npc', () => ({
        kind: 'npc',
        npc: generateNpc(Math.random, undefined, species),
      })),
      label: 'NPC generator',
      separator: true,
    },
    {
      ...simple('names', 'names', () => ({ kind: 'names', names: generateNames(20, species) })),
      label: 'Name generator',
    },
    {
      ...simple('converter', 'converter', () => ({ kind: 'converter', value: 30, unit: 'ft' })),
      label: 'Unit converter',
    },
    simple('screen', 'screen', () => ({ kind: 'screen', section: 'conditions' })),
    simple('table', 'table', () => ({ kind: 'table' })),
    simple('text', 'text', () => ({ kind: 'text', text: '' })),
    simple('dice', 'dice', () => ({ kind: 'dice', formulas: [] })),
    simple('timer', 'timer', () => ({ kind: 'timer', seconds: 600, elapsed: 0 })),
    simple('combat', 'combat', () => ({ kind: 'combat', combatants: [], turn: null, round: 1 })),
    simple('frame', 'frame', () => ({ kind: 'frame', title: 'Frame' })),
  ];
}

export const itemClass =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none data-[highlighted]:bg-sunken data-[disabled]:text-faint hover:bg-sunken disabled:text-faint';
