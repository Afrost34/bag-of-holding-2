import { createFileRoute } from '@tanstack/react-router';
import { JournalPage } from '../features/journal/JournalPage';

export const Route = createFileRoute('/journal')({
  // `note`: the open note's path in the journal, e.g. `Places/Waterdeep.md`.
  validateSearch: (search: Record<string, unknown>): { note?: string } =>
    typeof search.note === 'string' && search.note ? { note: search.note } : {},
  component: function JournalRoute() {
    const { note } = Route.useSearch();
    return <JournalPage note={note} />;
  },
});
