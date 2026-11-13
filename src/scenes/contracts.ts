/**
 * SCENE CONTRACTS — the props each scene must accept. Owner: Pink.
 * Aser's step pages render these and lay their HUD on top. Pink can replace the
 * placeholder implementations freely, but keep these props stable (or agree changes with Aser).
 */
import type { HorizonProfile, IsoTime, LaunchPlan, Site, SkyState } from '@/shared/types';

/** Step 1 — pick landing sites on the Moon. */
export interface SitePickerGlobeProps {
  sites: Site[];
  selectedIds: string[];
  /** Click a pin. */
  onSelectSite: (siteId: string) => void;
  /** Click empty terrain → custom coordinates. */
  onPickCoords?: (lat: number, lon: number) => void;
}

/** Step 2 (full) and step 3 (compact cards) — the view from a site. */
export interface SitePanoramaProps {
  site: Site;
  time: IsoTime;
  sky?: SkyState;
  horizon?: HorizonProfile;
  /** 'stand' = first-person, drag to look around. 'above' = fly-over of the terrain. */
  mode?: 'stand' | 'above';
  /** Small card version (compare). Pink: share one Canvas across cards via drei <View>. */
  compact?: boolean;
}

/** Step 5 — launch from Earth to touchdown at the site. Real vehicles only, never the Shuttle. */
export interface LaunchSequenceProps {
  site: Site;
  plan: LaunchPlan;
  /** Called when the animation ends or the user skips. */
  onDone: () => void;
}
