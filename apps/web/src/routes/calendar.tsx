import { createFileRoute } from '@tanstack/react-router';
import { CalendarPage } from '../features/calendar/CalendarPage';

export const Route = createFileRoute('/calendar')({
  component: CalendarPage,
});
