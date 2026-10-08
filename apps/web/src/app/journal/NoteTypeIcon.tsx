import type { NoteType } from '@boh/journal';
import { ICONS } from './noteTypeIcons';

/** The icon of a kind of note (NPC, location, a kind of the DM's own…). */
export function NoteTypeIcon({
  type,
  className = 'h-4 w-4',
}: {
  type: Pick<NoteType, 'icon'>;
  className?: string;
}) {
  const Icon = ICONS[type.icon] ?? ICONS.file;
  return Icon ? <Icon className={className} aria-hidden /> : null;
}
