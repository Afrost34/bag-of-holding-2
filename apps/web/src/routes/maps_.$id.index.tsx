import { createFileRoute } from '@tanstack/react-router';
import { MapEditor } from '../features/maps/MapEditor';

/** A map, to use: pins, notes, routes, ranges. */
export const Route = createFileRoute('/maps_/$id/')({
  component: function MapRoute() {
    const { id } = Route.useParams();
    return <MapEditor id={id} mode="viewer" />;
  },
});
