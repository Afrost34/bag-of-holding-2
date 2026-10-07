import { createFileRoute } from '@tanstack/react-router';
import { BoardPage } from '../features/boards/BoardPage';

export const Route = createFileRoute('/boards_/$id')({
  // `focus` is a card to bring into view (a combat just started from an encounter).
  validateSearch: (search: Record<string, unknown>): { focus?: string } =>
    typeof search.focus === 'string' ? { focus: search.focus } : {},
  component: function BoardRoute() {
    const { id } = Route.useParams();
    const { focus } = Route.useSearch();
    return <BoardPage id={id} {...(focus ? { focus } : {})} />;
  },
});
