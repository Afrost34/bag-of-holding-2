import { createFileRoute } from '@tanstack/react-router';
import { LibraryPage } from '../features/compendium/LibraryPage';
import { NotFoundPage } from '../features/not-found/NotFoundPage';

export const Route = createFileRoute('/compendium_/library/$kind')({
  component: function LibraryRoute() {
    const { kind } = Route.useParams();
    // Books and adventures share one page; the old adventures address opens it on adventures.
    if (kind === 'books') return <LibraryPage key={kind} />;
    if (kind === 'adventures') return <LibraryPage key={kind} initial="adventure" />;
    return <NotFoundPage />;
  },
});
