/**
 * SHARED CONTRACT — every screen, scene and the engine build against these types.
 * Owner: Hagras. Ask before changing; additive changes (new optional fields) are safest.
 *
 * Conventions
 *  - Angles in DEGREES. Azimuth measured clockwise from lunar north (N=0°, E=90°).
 *  - Longitude east-positive, −180…180. Latitude −90 (south pole) … 90.
 *  - Times are ISO-8601 strings in UTC ("2026-11-13T12:00:00Z"). Format for display only.
 *  - Distances in km, durations in hours, heights in metres.
 *  - Every value object carries `source` so the UI can label where a number came from.
 */

/** Where a number came from. `demo` must always be visibly labelled in the UI. */
export type DataSource = 'demo' | 'horizons' | 'lola' | 'computed';

export interface Sourced {
  source: DataSource;
}

/** UTC ISO-8601 timestamp. */
export type IsoTime = string;

export interface SourceRef {
  label: string;
  url: string;
}

// ---------------------------------------------------------------- Sites

export type SiteKind =
  | 'artemis-candidate' // NASA Artemis III south-pole candidate region
  | 'historic-landing' // successful landing (Apollo, Luna, Chang'e, …)
  | 'failed-landing' // crash / partial landing, kept for its lesson
  | 'custom'; // user-entered coordinates

export type SiteRegion = 'south-pole' | 'nearside' | 'farside' | 'north-pole';

export interface Mission {
  name: string; // "Apollo 11"
  agency: string; // "NASA", "CNSA", "ISRO", "JAXA", "Intuitive Machines" …
  date: IsoTime; // landing date (UTC)
  outcome: 'success' | 'partial' | 'failed';
}

export interface Site extends Sourced {
  id: string; // stable slug, e.g. "apollo-11", "shackleton-rim"
  name: string;
  kind: SiteKind;
  region: SiteRegion;
  lat: number;
  lon: number;
  /** Surface elevation relative to the 1737.4 km reference sphere (LOLA), metres. */
  elevationM?: number;
  /** 2–3 line plain-language story for the public. */
  story: string;
  mission?: Mission;
  /** Where the coordinates / story come from. Shown in credits. */
  refs: SourceRef[];
}

// ---------------------------------------------------------------- Terrain horizon

/**
 * Terrain horizon around a site: the elevation angle of the skyline for every azimuth.
 * `elevationsDeg[i]` is the horizon at azimuth `i * azStepDeg`. Lunar curvature included.
 */
export interface HorizonProfile extends Sourced {
  siteId: string;
  azStepDeg: number; // e.g. 1 → 360 samples
  elevationsDeg: number[];
  /** How far the terrain search reached, km (long reach matters at the pole). */
  maxRangeKm: number;
  /** Observer height above ground used to compute it, metres (e.g. 2 m = lander mast). */
  observerHeightM: number;
}

// ---------------------------------------------------------------- Sky

export interface BodyPosition {
  azDeg: number;
  /** Elevation above the mathematical (flat) horizon. */
  elDeg: number;
  /** Elevation of the terrain horizon at this body's azimuth. */
  horizonElDeg: number;
  /** elDeg − horizonElDeg. Positive = above the real skyline. */
  clearanceDeg: number;
  distanceKm: number;
  angularDiameterDeg: number;
  /** Fraction (0–1) of the disk above the terrain horizon. */
  visibleFraction: number;
}

export interface SkyState extends Sourced {
  siteId: string;
  time: IsoTime;
  sun: BodyPosition;
  earth: BodyPosition & {
    /** Illuminated fraction of Earth's disk as seen from the Moon (0 new … 1 full). */
    illumination: number;
  };
  /** Any part of the solar disk above the terrain horizon. */
  sunVisible: boolean;
  /** Earth clears the horizon by at least Params.commsMinClearanceDeg. */
  earthVisible: boolean;
}

// ---------------------------------------------------------------- Windows & reports

export interface TimeWindow {
  start: IsoTime;
  end: IsoTime;
  durationH: number;
  /** True if the window was cut by the report range (real start/end lies outside). */
  clipped: boolean;
}

/** One lunar day (or any range) sampled at a fixed step for one site. */
export interface DayReport extends Sourced {
  siteId: string;
  start: IsoTime;
  end: IsoTime;
  stepMinutes: number;
  samples: SkyState[];
  sunWindows: TimeWindow[];
  earthWindows: TimeWindow[];
}

/** Summary numbers for cards, comparisons and scores. */
export interface SiteMetrics extends Sourced {
  siteId: string;
  from: IsoTime;
  to: IsoTime;
  /** 0–1 share of the range with any sunlight. */
  sunlitFraction: number;
  /** 0–1 share of the range with Earth above the horizon. */
  earthVisibleFraction: number;
  maxSunElDeg: number;
  /** Longest continuous darkness, hours (battery sizing). */
  longestNightH: number;
  /** Longest continuous Earth blackout, hours. */
  longestCommsGapH: number;
  /** Next transitions after `from`; null if none in range. */
  nextSunset: IsoTime | null;
  nextSunrise: IsoTime | null;
  nextEarthset: IsoTime | null;
  nextEarthrise: IsoTime | null;
  /** 0–100, higher is better. Engine-defined; explained in the UI. */
  powerScore: number;
  commsScore: number;
  /** 0–1 share of the range with sunlight AND Earth in view at the same time. */
  bothFraction: number;
  /** Longest continuous stretch with sunlight AND Earth in view — the best landing window. */
  bestWindow: TimeWindow | null;
  /** 0–100 overall suitability used to rank sites/dates. Engine explains the formula. */
  matchScore: number;
}

// ---------------------------------------------------------------- Mission

/**
 * Launch → landing. Conditions are judged at the LANDING date.
 * `transitDays` is an assumption set by the engine and shown to the user.
 */
export interface LaunchPlan extends Sourced {
  siteId: string;
  launchDate: IsoTime;
  landingDate: IsoTime;
  transitDays: number;
  /** One-line plain-language note about the assumption. */
  assumption: string;
}

// ---------------------------------------------------------------- Parameters

/** User-adjustable assumptions. Defaults live in DEFAULT_PARAMS. */
export interface Params {
  /** Height of solar panels / antenna above ground, metres. */
  observerHeightM: number;
  /** Minimum Earth clearance above the terrain for a usable radio link, degrees. */
  commsMinClearanceDeg: number;
  /** Sampling step for day reports, minutes. */
  stepMinutes: number;
}

export const DEFAULT_PARAMS: Params = {
  observerHeightM: 2,
  commsMinClearanceDeg: 0,
  stepMinutes: 60,
};

// ---------------------------------------------------------------- Constants

export const LUNAR = {
  radiusKm: 1737.4,
  synodicDays: 29.530589, // one lunar day
  /** Period of the Sun's declination cycle as seen from the Moon (eclipse year). */
  solarSeasonDays: 346.62,
  axialTiltDeg: 1.54,
  sunDiameterDeg: 0.53,
} as const;
