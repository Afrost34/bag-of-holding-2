import { createFileRoute } from '@tanstack/react-router';
import { PrintPage } from '../features/characters/print/PrintPage';

export const Route = createFileRoute('/characters_/$id_/print')({
  component: function PrintRoute() {
    const { id } = Route.useParams();
    return <PrintPage id={id} />;
  },
});
