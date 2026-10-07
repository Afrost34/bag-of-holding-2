import { createFileRoute } from '@tanstack/react-router';
import { ReaderPage, type ReaderSearch } from '../features/compendium/ReaderPage';
import { readerSearch } from '../features/compendium/readerSearch';

export const Route = createFileRoute('/compendium_/adventure/$id')({
  validateSearch: (search: Record<string, unknown>): ReaderSearch => readerSearch(search),
  component: function AdventureRoute() {
    const { id } = Route.useParams();
    return <ReaderPage kind="adventure" id={id} search={Route.useSearch()} />;
  },
});
