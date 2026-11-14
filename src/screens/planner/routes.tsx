/** Owner: Aser — the mission flow (Plan a mission). Add/adjust step routes here. */
import type { OwnerRoutes } from '@/app/routeTypes';
import { ChooseSitePage } from './ChooseSitePage';
import { ComparePage } from './ComparePage';
import { DatePage } from './DatePage';
import { LaunchPage } from './LaunchPage';
import { StandPage } from './StandPage';
import { PlannerLayout } from '@/screens/journey/PlannerGuide';

export const plannerRoutes: OwnerRoutes = [
  {
    path: 'mission',
    // Refaey leads every step (the guide floats over the page).
    element: <PlannerLayout />,
    children: [
      { index: true, element: <ChooseSitePage />, handle: { title: 'Choose your site', caption: 'Step 01 — Choose your site' } },
      { path: 'stand', element: <StandPage />, handle: { title: 'Stand on site', caption: 'Step 02 — Read the sky' } },
      { path: 'compare', element: <ComparePage />, handle: { title: 'Compare', caption: 'Step 03 — Compare' } },
      { path: 'date', element: <DatePage />, handle: { title: 'Launch date', caption: 'Step 04 — Pick a launch date' } },
      { path: 'launch', element: <LaunchPage />, handle: { title: 'Launch', caption: 'Step 05 — Launch' } },
    ],
  },
];
