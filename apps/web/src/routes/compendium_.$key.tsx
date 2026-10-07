import { createFileRoute } from '@tanstack/react-router';
import { EntityPage } from '../features/compendium/EntityPage';
import { ClassPage } from '../features/compendium/pages/ClassPage';
import { SpeciesPage } from '../features/compendium/pages/SpeciesPage';
import { SubclassPage } from '../features/compendium/pages/SubclassPage';

export const Route = createFileRoute('/compendium_/$key')({
  // `sc`: the subclass shown on a class page.
  validateSearch: (search: Record<string, unknown>): { sc?: string } =>
    typeof search.sc === 'string' ? { sc: search.sc } : {},
  component: function EntityRoute() {
    const { key } = Route.useParams();
    const { sc } = Route.useSearch();
    // Keys start with their type: `class:fighter@xphb`.
    switch (key.slice(0, key.indexOf(':'))) {
      case 'class':
        return <ClassPage key={key} entityKey={key} {...(sc ? { subclass: sc } : {})} />;
      case 'subclass':
        return <SubclassPage key={key} entityKey={key} />;
      case 'race':
        return <SpeciesPage key={key} entityKey={key} />;
      default:
        return <EntityPage key={key} entityKey={key} />;
    }
  },
});
