import { createFileRoute } from '@tanstack/react-router';
import { MapsPage } from '../features/maps/MapsPage';

export const Route = createFileRoute('/maps')({
  component: MapsPage,
});
