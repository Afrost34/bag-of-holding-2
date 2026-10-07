import { createFileRoute } from '@tanstack/react-router';
import { CardsPage } from '../features/cards/CardsPage';

export const Route = createFileRoute('/cards')({
  component: CardsPage,
});
