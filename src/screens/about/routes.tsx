/** Owner: Goda — the project page: sources, credits, AI-use disclosure, team. */
import type { OwnerRoutes } from '@/app/routeTypes';
import { AboutPage } from './AboutPage';

export const aboutRoutes: OwnerRoutes = [
  { path: 'about', element: <AboutPage />, handle: { title: 'The project', caption: 'Sources & credits' } },
];
