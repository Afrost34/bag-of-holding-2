import { createFileRoute } from '@tanstack/react-router';
import { CharactersPage } from '../features/characters/CharactersPage';

export const Route = createFileRoute('/characters')({
  component: CharactersPage,
});
