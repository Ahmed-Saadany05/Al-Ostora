import type { RouteObject } from 'react-router-dom';

/** Put on a route as `handle` — the shell shows the caption in the status bar. */
export interface RouteHandle {
  /** Browser tab title. */
  title?: string;
  /** Short uppercase caption in the footer, e.g. "The journey begins". */
  caption?: string;
  /** Hide the footer status bar on this route (e.g. the cinematic Home). Header stays. */
  minimalChrome?: boolean;
}

/** Each owner exports one of these from their folder's routes.tsx. */
export type OwnerRoutes = RouteObject[];
