import { createFileRoute } from '@tanstack/react-router';
import { CardSheetPage } from '../features/cards/CardSheetPage';

export const Route = createFileRoute('/cards_/$id')({
  component: function CardSheetRoute() {
    const { id } = Route.useParams();
    return <CardSheetPage id={id} />;
  },
});
