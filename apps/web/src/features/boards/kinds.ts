import type { Node } from '@xyflow/react';
import {
  BookOpen,
  CalendarDays,
  Dices,
  Frame,
  Image,
  Layers,
  Map as MapIcon,
  UserRound,
  Ruler,
  ScrollText,
  ListOrdered,
  Tags,
  Wand2,
  Swords,
  Skull,
  NotebookPen,
  StickyNote,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import type { BoardCard, CardKind } from '../../app/boards/model';
import { useEntity } from '../../app/data/entities';
import { useCharacters } from '../../app/characters/store';
import { useEncounters } from '../../app/encounters/store';
import { useMaps } from '../../app/maps/store';
import { useTables } from '../../app/tables/store';

/** Below this zoom cards show their title only, large: cheap to draw and readable from afar. */
export const FAR_ZOOM = 0.2;

export interface CardData extends Record<string, unknown> {
  card: BoardCard;
  /** A stack's cards, in tab order. */
  members?: BoardCard[];
}
export type CardNodeType = Node<CardData, 'card' | 'stack' | 'frame'>;

export const KIND_ICONS: Record<CardKind, LucideIcon> = {
  entity: BookOpen,
  note: NotebookPen,
  image: Image,
  text: StickyNote,
  dice: Dices,
  timer: Timer,
  combat: Swords,
  encounter: Skull,
  map: MapIcon,
  character: UserRound,
  npc: Wand2,
  names: Tags,
  converter: Ruler,
  screen: ScrollText,
  table: ListOrdered,
  calendar: CalendarDays,
  frame: Frame,
  stack: Layers,
};

export const KIND_LABELS: Record<CardKind, string> = {
  entity: 'Compendium',
  note: 'Note',
  image: 'Picture',
  text: 'Text',
  dice: 'Dice',
  timer: 'Timer',
  combat: 'Combat',
  encounter: 'Encounter',
  map: 'Map',
  character: 'Character',
  npc: 'NPC',
  names: 'Names',
  converter: 'Unit converter',
  screen: 'DM screen',
  table: 'Random table',
  calendar: 'Calendar',
  frame: 'Frame',
  stack: 'Stack',
};

/** A card's title: its own, else what it shows (the entity's name, the note's). */
export function useCardTitle(card: BoardCard): string {
  const entity = useEntity(card.kind === 'entity' ? card.key : null);
  const encounter = useEncounters((s) =>
    card.kind === 'encounter' ? s.encounters.find((e) => e.id === card.encounter)?.name : undefined,
  );
  const map = useMaps((s) =>
    card.kind === 'map' ? s.maps.find((m) => m.id === card.map)?.name : undefined,
  );
  const table = useTables((s) =>
    card.kind === 'table' ? s.tables.find((t) => t.id === card.table)?.name : undefined,
  );
  const character = useCharacters((s) =>
    card.kind === 'character' ? s.characters.find((c) => c.id === card.character)?.name : undefined,
  );
  if (card.title) return card.title;
  if (card.kind === 'entity')
    return entity.status === 'found'
      ? entity.entity.name
      : (card.key.split(':')[1]?.split('@')[0] ?? '');
  if (card.kind === 'note') return card.path.split('/').pop()?.replace(/\.md$/i, '') ?? card.path;
  if (card.kind === 'frame') return card.title;
  if (card.kind === 'encounter') return encounter ?? KIND_LABELS.encounter;
  if (card.kind === 'map') return map ?? KIND_LABELS.map;
  if (card.kind === 'character') return character ?? KIND_LABELS.character;
  if (card.kind === 'npc') return card.npc.name;
  if (card.kind === 'table') return table ?? KIND_LABELS.table;
  return KIND_LABELS[card.kind];
}
