import { createFileRoute } from '@tanstack/react-router';
import { CompendiumPage } from '../features/compendium/CompendiumPage';

export const Route = createFileRoute('/compendium')({
  component: CompendiumPage,
});
