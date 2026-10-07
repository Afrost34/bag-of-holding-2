import { TooltipProvider } from '@boh/ui';
import {
  createHashHistory,
  createRouter,
  parseSearchWith,
  RouterProvider,
  stringifySearchWith,
} from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { routeTree } from './routeTree.gen';

// Hash history: deep links work on GitHub Pages, inside Tauri and offline without server rewrites.
const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultPreload: 'intent',
  // Plain query strings: every search value stays a string (`ch=1`, not `ch=%221%22`), and
  // links built by hand (AppLink paths) match what the router writes back.
  parseSearch: parseSearchWith((value) => value),
  stringifySearch: stringifySearchWith(String, (value) => value),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

createRoot(rootElement).render(
  <StrictMode>
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  </StrictMode>,
);
