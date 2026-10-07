import { createFileRoute } from '@tanstack/react-router';
import { SyncSettingsPage } from '../features/settings/SyncSettingsPage';

export const Route = createFileRoute('/settings_/sync')({
  component: SyncSettingsPage,
});
