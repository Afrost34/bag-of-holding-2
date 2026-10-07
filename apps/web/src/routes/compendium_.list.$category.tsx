import { categoryById } from '@boh/data5e';
import { createFileRoute } from '@tanstack/react-router';
import { CardGridPage } from '../features/compendium/CardGridPage';
import { ListPage } from '../features/compendium/ListPage';
import { NotFoundPage } from '../features/not-found/NotFoundPage';

export const Route = createFileRoute('/compendium_/list/$category')({
  // Filters live in the URL (see listModel.stateFromSearch). The router JSON-parses values, so
  // `level=3` arrives as a number: turn every simple value back into a string.
  validateSearch: (search: Record<string, unknown>): Record<string, string> =>
    Object.fromEntries(
      Object.entries(search).flatMap(([k, v]) =>
        typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
          ? [[k, String(v)]]
          : [],
      ),
    ),
  component: function ListRoute() {
    const { category: id } = Route.useParams();
    const search = Route.useSearch();
    const category = categoryById(id);
    if (!category) return <NotFoundPage />;
    return category.layout === 'cards' ? (
      <CardGridPage key={id} category={category} search={search} />
    ) : (
      <ListPage key={id} category={category} search={search} />
    );
  },
});
