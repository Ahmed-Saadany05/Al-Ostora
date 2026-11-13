import type { SiteKind } from '@/shared/types';
import type { IconName } from '@/shared/ui';
import type { SitePickerGlobeProps } from '../contracts';
import type { LatLon, RegionId } from '../lib/moonFrame';

/** Where the camera should go: look at `lat/lon` from `distance` lunar radii (null = keep distance). */
export interface CameraGoal extends LatLon {
  distance: number | null;
  /** Changes on every request, so asking for the same place twice still moves the camera. */
  key: number;
}

/** Props of the lazily loaded 3D view. The parent (SitePickerGlobe) owns the flow state. */
export interface PickerGlobe3DProps extends SitePickerGlobeProps {
  /** Region to glow strongly (menu hover or Moon hover). */
  hoverRegion: RegionId | null;
  /** Region the menu is showing; glows softly. */
  activeRegion: RegionId | null;
  /** Site hovered in the menu: its pin lights up. */
  hotSiteId: string | null;
  goal: CameraGoal | null;
  ripple: (LatLon & { key: number }) | null;
  onMoonHoverRegion: (region: RegionId | null) => void;
  onMoonClick: (p: LatLon) => void;
}

/** Camera distances in lunar radii. */
export const START_DISTANCE = 4.4; // whole disc fits the 32° view with a margin
export const SECTOR_DISTANCE = 3.3;
export const SITE_DISTANCE = 1.18; // close-up, ≈ 310 km above the site

export const KIND_ICON: Record<SiteKind, IconName> = {
  'artemis-candidate': 'pin',
  'historic-landing': 'check',
  'failed-landing': 'alert',
  custom: 'plus',
};
export const KIND_WORD: Record<SiteKind, string> = {
  'artemis-candidate': 'Artemis candidate',
  'historic-landing': 'Landing site',
  'failed-landing': 'Landing attempt',
  custom: 'Your pin',
};
