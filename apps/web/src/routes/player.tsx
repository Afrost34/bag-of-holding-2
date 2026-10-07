import { createFileRoute } from '@tanstack/react-router';
import { PlayerPage } from '../features/boards/PlayerPage';

export const Route = createFileRoute('/player')({
  component: PlayerPage,
});
