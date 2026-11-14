/**
 * Owner: Hady — Home. My Sky and lessons are no longer pages: they live inside the
 * mission steps (plain-language explainers). Add Home sections here.
 */
import type { OwnerRoutes } from '@/app/routeTypes';
import { HomePage } from './HomePage';
import { MissionsHub } from '@/screens/journey/MissionsHub';
import { MissionStory } from '@/screens/journey/MissionStory';
import { RefaeySandbox } from './refaey/RefaeySandbox';

export const homeRoutes: OwnerRoutes = [
  { index: true, element: <HomePage />, handle: { title: 'Explore', caption: 'The journey begins', minimalChrome: true } },
  { path: 'missions', element: <MissionsHub />, handle: { title: 'Past missions', caption: 'Past missions — where and when they landed' } },
  { path: 'missions/:id', element: <MissionStory />, handle: { title: 'Past mission', caption: 'Past missions — stand where they landed' } },
  // Dev-only bench for Refaey (not in production builds).
  ...(import.meta.env.DEV ? [{ path: 'refaey', element: <RefaeySandbox />, handle: { title: 'Refaey sandbox', caption: 'Refaey sandbox' } }] : []),
];
