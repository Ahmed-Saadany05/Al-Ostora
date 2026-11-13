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
  /** Opened by the Home flight: start on the opening view it landed on (see moonHandoff). */
  fromHome?: boolean;
  /** First Moon Trek imagery is on screen. */
  onImageryReady?: () => void;
}

/** Camera distances in lunar radii. */
export const START_DISTANCE = 5.2; // whole disc ≈ 70 % of the view height, with room around it
export const SECTOR_DISTANCE = 3.3;
export const SITE_DISTANCE = 1.18; // close-up, ≈ 310 km above the site

export const KIND_ICON: Record<SiteKind, IconName> = {
  candidate: 'pin',
  'landing-site': 'check',
  'crash-site': 'alert',
  custom: 'plus',
};
export const KIND_WORD: Record<SiteKind, string> = {
  candidate: 'Candidate',
  'landing-site': 'Landing site',
  'crash-site': 'Crash site',
  custom: 'Your pin',
};

/** Step 1 camera: vertical field of view, and the opening view (also where Home's flight lands). */
export const PICKER_FOV = 32;
export const OPENING_VIEW = { lat: -55, lon: 8 } as const;

/**
 * Opening camera distance for a globe box of w × h px: START_DISTANCE, or further back when the box
 * is narrow, so the whole disc always fits (at most 90 % of the width).
 */
export function openingDistance(w: number, h: number): number {
  const focal = h / 2 / Math.tan(((PICKER_FOV / 2) * Math.PI) / 180);
  const radius = Math.min(focal / Math.sqrt(START_DISTANCE ** 2 - 1), 0.45 * w);
  return Math.sqrt(1 + (focal / Math.max(radius, 1)) ** 2);
}

/** Goal distance meaning "the opening distance for this box" (see openingDistance). */
export const FIT_DISTANCE = -1;

/** Letter for the i-th site of a sector (A, B, … Z, then AA, AB …), shared by the menu and the pins. */
export function siteLetter(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : siteLetter(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
}

/**
 * Step 1 lights the Moon from the viewer (a full Moon, as in the design), from slightly above-left
 * so craters keep a little relief. Offsets are in camera axes (up, left), added to the direction
 * back toward the camera. Home's flight ends on the same light, so the hand-off matches.
 */
export const VIEWER_LIGHT = { up: 0.18, left: 0.12 } as const;
