import { createFileRoute } from '@tanstack/react-router';
import { TablePage } from '../features/tables/TablePage';

export const Route = createFileRoute('/tables_/$id')({
  component: function TableRoute() {
    const { id } = Route.useParams();
    return <TablePage id={id} />;
  },
});
