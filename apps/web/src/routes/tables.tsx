import { createFileRoute } from '@tanstack/react-router';
import { TablesPage } from '../features/tables/TablesPage';

export const Route = createFileRoute('/tables')({
  component: TablesPage,
});
