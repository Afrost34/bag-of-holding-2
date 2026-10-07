import type { Node } from '@xyflow/react';
import {
  BookOpen,
  Dices,
  Frame,
  Image,
  Layers,
  ListOrdered,
  NotebookPen,
  StickyNote,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import type { BoardCard, CardKind } from '../../app/boards/model';
import { useEntity } from '../../app/data/entities';

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
  frame: 'Frame',
  stack: 'Stack',
};

/** A card's title: its own, else what it shows (the entity's name, the note's). */
export function useCardTitle(card: BoardCard): string {
  const entity = useEntity(card.kind === 'entity' ? card.key : null);
  if (card.title) return card.title;
  if (card.kind === 'entity')
    return entity.status === 'found'
      ? entity.entity.name
      : (card.key.split(':')[1]?.split('@')[0] ?? '');
  if (card.kind === 'note') return card.path.split('/').pop()?.replace(/\.md$/i, '') ?? card.path;
  if (card.kind === 'frame') return card.title;
  return KIND_LABELS[card.kind];
}
