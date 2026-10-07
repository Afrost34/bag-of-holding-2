import { createFileRoute } from '@tanstack/react-router';
import { ReaderPage, type ReaderSearch } from '../features/compendium/ReaderPage';
import { readerSearch } from '../features/compendium/readerSearch';

export const Route = createFileRoute('/compendium_/quickref/$id')({
  validateSearch: (search: Record<string, unknown>): ReaderSearch => readerSearch(search),
  component: function QuickrefRoute() {
    const { id } = Route.useParams();
    return <ReaderPage kind="quickref" id={id} search={Route.useSearch()} />;
  },
});
