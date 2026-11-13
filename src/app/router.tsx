import { createBrowserRouter } from 'react-router-dom';
import { aboutRoutes } from '@/screens/about/routes';
import { homeRoutes } from '@/screens/home/routes';
import { plannerRoutes } from '@/screens/planner/routes';
import { AppShell } from './AppShell';
import { KitPage } from './KitPage';
import { NotFoundPage } from './NotFoundPage';

/**
 * Routes are composed from each owner's routes.tsx — add your screens THERE,
 * not here, so nobody edits this file at the same time.
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      ...homeRoutes,
      ...plannerRoutes,
      ...aboutRoutes,
      { path: 'kit', element: <KitPage />, handle: { title: 'UI kit', caption: 'UI kit — shared components' } },
      { path: '*', element: <NotFoundPage />, handle: { title: 'Lost in space', caption: 'Off the map' } },
    ],
  },
]);
