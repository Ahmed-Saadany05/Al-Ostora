/**
 * Owner: Hady — Home. My Sky and lessons are no longer pages: they live inside the
 * mission steps (plain-language explainers). Add Home sections here.
 */
import type { OwnerRoutes } from '@/app/routeTypes';
import { HomePage } from './HomePage';

export const homeRoutes: OwnerRoutes = [
  { index: true, element: <HomePage />, handle: { title: 'Explore', caption: 'The journey begins' } },
];
