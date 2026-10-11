import { createFileRoute } from '@tanstack/react-router';
import { PackContentsPage } from '../features/maps/PackContentsPage';

/** How the imported asset packs were sorted, to spot mistakes. */
export const Route = createFileRoute('/maps_/packs')({
  component: PackContentsPage,
});
