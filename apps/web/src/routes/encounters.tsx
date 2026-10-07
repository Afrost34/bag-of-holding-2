import { createFileRoute } from '@tanstack/react-router';
import { EncountersPage } from '../features/encounters/EncountersPage';

export const Route = createFileRoute('/encounters')({
  component: EncountersPage,
});
