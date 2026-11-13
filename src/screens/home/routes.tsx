/**
 * Owner: Hady — Home. My Sky and lessons are no longer pages: they live inside the
 * mission steps (plain-language explainers). Add Home sections here.
 */
import type { OwnerRoutes } from '@/app/routeTypes';
import { HomePage } from './HomePage';
import { MissionsPage } from './missions/MissionsPage';
import { RefaeySandbox } from './refaey/RefaeySandbox';

export const homeRoutes: OwnerRoutes = [
  { index: true, element: <HomePage />, handle: { title: 'Explore', caption: 'The journey begins', minimalChrome: true } },
  { path: 'missions', element: <MissionsPage />, handle: { title: 'Past missions', caption: 'Three landings, three lessons' } },
  // Dev-only bench for Refaey (not in production builds).
  ...(import.meta.env.DEV ? [{ path: 'refaey', element: <RefaeySandbox />, handle: { title: 'Refaey sandbox', caption: 'Refaey sandbox' } }] : []),
];
