import { createFileRoute } from '@tanstack/react-router';
import { ModulePlaceholder } from '../features/placeholder/ModulePlaceholder';

export const Route = createFileRoute('/homebrew')({
  component: () => <ModulePlaceholder path="/homebrew" />,
});
