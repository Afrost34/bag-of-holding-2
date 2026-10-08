import { createFileRoute } from '@tanstack/react-router';
import { NotesListPage } from '../features/compendium/NotesListPage';

export const Route = createFileRoute('/compendium_/notes/$type')({
  // `note`: a note of this kind to open in the list (where its links lead), by its path.
  validateSearch: (search: Record<string, unknown>): { note?: string } =>
    typeof search.note === 'string' && search.note ? { note: search.note } : {},
  component: function NotesListRoute() {
    const { type } = Route.useParams();
    const { note } = Route.useSearch();
    return <NotesListPage key={`${type}|${note ?? ''}`} typeId={type} note={note} />;
  },
});
