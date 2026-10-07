import type { Node } from '@xyflow/react';
import {
  BookOpen,
  Dices,
  Frame,
  Image,
  Layers,
  ListOrdered,
  Swords,
  Skull,
  NotebookPen,
  StickyNote,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import type { BoardCard, CardKind } from '../../app/boards/model';
import { useEntity } from '../../app/data/entities';
import { useEncounters } from '../../app/encounters/store';

/** Below this zoom cards show their title only, large: cheap to draw and readable from afar. */
export const FAR_ZOOM = 0.45;

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
  initiative: ListOrdered,
  combat: Swords,
  encounter: Skull,
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
  initiative: 'Initiative',
  combat: 'Combat',
  encounter: 'Encounter',
  frame: 'Frame',
  stack: 'Stack',
};

/** A card's title: its own, else what it shows (the entity's name, the note's). */
export function useCardTitle(card: BoardCard): string {
  const entity = useEntity(card.kind === 'entity' ? card.key : null);
  const encounter = useEncounters((s) =>
    card.kind === 'encounter' ? s.encounters.find((e) => e.id === card.encounter)?.name : undefined,
  );
  if (card.title) return card.title;
  if (card.kind === 'entity')
    return entity.status === 'found'
      ? entity.entity.name
      : (card.key.split(':')[1]?.split('@')[0] ?? '');
  if (card.kind === 'note') return card.path.split('/').pop()?.replace(/\.md$/i, '') ?? card.path;
  if (card.kind === 'frame') return card.title;
  if (card.kind === 'encounter') return encounter ?? KIND_LABELS.encounter;
  return KIND_LABELS[card.kind];
}
