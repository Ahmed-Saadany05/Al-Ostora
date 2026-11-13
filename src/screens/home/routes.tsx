/**
 * Owner: Hady — Home. My Sky and lessons are no longer pages: they live inside the
 * mission steps (plain-language explainers). Add Home sections here.
 */
import type { OwnerRoutes } from '@/app/routeTypes';
import { HomePage } from './HomePage';
import { RefaeySandbox } from './refaey/RefaeySandbox';

export const homeRoutes: OwnerRoutes = [
  { index: true, element: <HomePage />, handle: { title: 'Explore', caption: 'The journey begins', minimalChrome: true } },
  // Dev-only bench for Refaey (not in production builds).
  ...(import.meta.env.DEV ? [{ path: 'refaey', element: <RefaeySandbox />, handle: { title: 'Refaey sandbox', caption: 'Refaey sandbox' } }] : []),
];
