import { createFileRoute } from '@tanstack/react-router';
import { MapEditor } from '../features/maps/MapEditor';

/** A map, to draw: the Creator makes the map's art. */
export const Route = createFileRoute('/maps_/$id/edit')({
  component: function MapEditRoute() {
    const { id } = Route.useParams();
    return <MapEditor id={id} mode="creator" />;
  },
});
