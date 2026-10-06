import { createFileRoute } from '@tanstack/react-router';
import { EntityPage } from '../features/compendium/EntityPage';

export const Route = createFileRoute('/compendium_/$key')({
  component: function EntityRoute() {
    const { key } = Route.useParams();
    return <EntityPage key={key} entityKey={key} />;
  },
});
