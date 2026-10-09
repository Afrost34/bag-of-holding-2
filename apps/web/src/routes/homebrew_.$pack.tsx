import { createFileRoute } from '@tanstack/react-router';
import { PackPage } from '../features/homebrew/PackPage';

export const Route = createFileRoute('/homebrew_/$pack')({
  // `new=item` opens the editor for a new entry, `edit=item:Name` for an existing one; `tab=item`
  // is the kind of entries listed.
  validateSearch: (
    search: Record<string, unknown>,
  ): { new?: string; edit?: string; tab?: string } => ({
    ...(typeof search.tab === 'string' ? { tab: search.tab } : {}),
    ...(typeof search.new === 'string' ? { new: search.new } : {}),
    ...(typeof search.edit === 'string' ? { edit: search.edit } : {}),
  }),
  component: function PackRoute() {
    const { pack } = Route.useParams();
    const search = Route.useSearch();
    return <PackPage name={pack} edit={search.edit} isNew={search.new} tab={search.tab} />;
  },
});
