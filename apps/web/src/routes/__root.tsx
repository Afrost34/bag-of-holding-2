import { createRootRoute } from '@tanstack/react-router';
import { AppShell } from '../app/shell/AppShell';
import { NotFoundPage } from '../features/not-found/NotFoundPage';

export const Route = createRootRoute({
  component: AppShell,
  notFoundComponent: NotFoundPage,
});
