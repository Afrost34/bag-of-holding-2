import { createFileRoute } from '@tanstack/react-router';
import { DataPage } from '../features/data/DataPage';

export const Route = createFileRoute('/settings_/data')({
  component: DataPage,
});
