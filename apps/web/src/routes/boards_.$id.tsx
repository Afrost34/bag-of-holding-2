import { createFileRoute } from '@tanstack/react-router';
import { BoardPage } from '../features/boards/BoardPage';

export const Route = createFileRoute('/boards_/$id')({
  component: function BoardRoute() {
    const { id } = Route.useParams();
    return <BoardPage id={id} />;
  },
});
