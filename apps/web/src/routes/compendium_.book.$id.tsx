import { createFileRoute } from '@tanstack/react-router';
import { ReaderPage, type ReaderSearch } from '../features/compendium/ReaderPage';
import { readerSearch } from '../features/compendium/readerSearch';

export const Route = createFileRoute('/compendium_/book/$id')({
  validateSearch: (search: Record<string, unknown>): ReaderSearch => readerSearch(search),
  component: function BookRoute() {
    const { id } = Route.useParams();
    return <ReaderPage kind="book" id={id} search={Route.useSearch()} />;
  },
});
