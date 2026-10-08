import { createFileRoute } from '@tanstack/react-router';
import { NotesListPage } from '../features/compendium/NotesListPage';

export const Route = createFileRoute('/compendium_/notes/$type')({
  component: function NotesListRoute() {
    const { type } = Route.useParams();
    return <NotesListPage key={type} typeId={type} />;
  },
});
