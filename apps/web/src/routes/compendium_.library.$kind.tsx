import { createFileRoute } from '@tanstack/react-router';
import { LibraryPage } from '../features/compendium/LibraryPage';
import { NotFoundPage } from '../features/not-found/NotFoundPage';

export const Route = createFileRoute('/compendium_/library/$kind')({
  component: function LibraryRoute() {
    const { kind } = Route.useParams();
    if (kind === 'books') return <LibraryPage key={kind} kind="book" />;
    if (kind === 'adventures') return <LibraryPage key={kind} kind="adventure" />;
    return <NotFoundPage />;
  },
});
