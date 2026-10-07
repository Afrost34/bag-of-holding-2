import { createFileRoute } from '@tanstack/react-router';
import { CharacterPage } from '../features/characters/CharacterPage';
import { isStep, type StepId } from '../features/characters/steps';

export const Route = createFileRoute('/characters_/$id')({
  // `step` picks the builder step (class, species, background…).
  validateSearch: (search: Record<string, unknown>): { step?: StepId } =>
    isStep(search.step) ? { step: search.step } : {},
  component: function CharacterRoute() {
    const { id } = Route.useParams();
    const { step } = Route.useSearch();
    return <CharacterPage id={id} step={step ?? 'class'} />;
  },
});
