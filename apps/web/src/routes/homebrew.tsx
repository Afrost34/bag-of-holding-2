import { createFileRoute } from '@tanstack/react-router';
import { HomebrewPage } from '../features/homebrew/HomebrewPage';

export const Route = createFileRoute('/homebrew')({
  component: HomebrewPage,
});
