import { createFileRoute } from '@tanstack/react-router';
import { EncounterPage } from '../features/encounters/EncounterPage';

export const Route = createFileRoute('/encounters_/$id')({
  component: function EncounterRoute() {
    const { id } = Route.useParams();
    return <EncounterPage id={id} />;
  },
});
