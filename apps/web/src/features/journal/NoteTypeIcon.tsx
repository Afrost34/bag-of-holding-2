import type { NoteType } from '@boh/journal';
import { Calendar, Church, FileText, Flag, MapPin, Scroll, Sun, User } from 'lucide-react';

const ICONS: Record<string, typeof FileText | undefined> = {
  user: User,
  'map-pin': MapPin,
  flag: Flag,
  calendar: Calendar,
  scroll: Scroll,
  church: Church,
  sun: Sun,
};

/** The icon of a kind of note (NPC, location…). */
export function NoteTypeIcon({
  type,
  className = 'h-4 w-4',
}: {
  type: NoteType;
  className?: string;
}) {
  const Icon = ICONS[type.icon] ?? FileText;
  return <Icon className={className} aria-hidden />;
}
