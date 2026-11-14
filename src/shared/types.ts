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

/**
 * Where a number came from. `demo` must always be visibly labelled in the UI.
 * `catalogue` = sourced site data (NASA NSSDC / LROC / NASA documents), see Site.refs.
 */
export type DataSource = 'demo' | 'horizons' | 'lola' | 'computed' | 'catalogue';

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

/**
 * A SITE is a place (fixed coordinates). A MISSION is an event that happened (or will
 * happen) there. One site can have several missions (Apollo 12 landed next to Surveyor 3),
 * and a candidate site can have none yet.
 */
export type SiteKind =
  | 'landing-site' // at least one landing (successful or partial)
  | 'crash-site' // only crashes — kept for the lesson
  | 'candidate' // planned / proposed, nothing has landed yet
  | 'custom'; // user-entered coordinates

export type SiteRegion = 'south-pole' | 'nearside' | 'farside' | 'north-pole';

/** Programme families — these drive the filter tags. */
export type Program =
  | 'apollo' // NASA crewed Apollo landings
  | 'nasa-robotic' // NASA's own robotic landers (Surveyor)
  | 'artemis' // Artemis / Moon Base (NASA human-landing campaign)
  | 'clps' // NASA Commercial Lunar Payload Services deliveries
  | 'commercial' // private missions outside CLPS
  | 'international'; // other countries' space programmes

export type MissionOutcome = 'landed' | 'partial' | 'crashed' | 'upcoming';

export interface Mission {
  name: string; // "Apollo 11"
  agency: string; // "NASA", "CNSA", "ISRO", "JAXA", "Intuitive Machines" …
  country: string; // "United States", "China", "India", …
  program: Program;
  /** Landing / impact day (UTC, "YYYY-MM-DD"). Omitted for upcoming missions without a fixed day — see `dateNote`. */
  date?: string;
  /** Free text when the date isn't a fixed day, e.g. "NASA: no earlier than fall 2026". */
  dateNote?: string;
  crewed: boolean;
  /** What touched down, e.g. ["lander", "rover Lunokhod 1"]. */
  hardware: string[];
  outcome: MissionOutcome;
  /** One line: what happened / the lesson. */
  note?: string;
}

/**
 * How exact the coordinates are (shown to the user with an icon + word):
 *  - measured       hardware seen in LRO Camera images (≈ ±15–30 m)
 *  - reported       published by the agency / NASA catalogue but not image-confirmed (≈ km)
 *  - planned-target an announced landing point for a mission that hasn't flown
 *  - region-site    a published point standing for a study/candidate area (NASA Data Book centre, or a
 *                   peer-reviewed landing site inside a NASA region; areas are ~km to ~15 km)
 *  - custom         typed or clicked by the user
 */
export type CoordQuality = 'measured' | 'reported' | 'planned-target' | 'region-site' | 'custom';

export interface Site extends Sourced {
  id: string; // stable slug, e.g. "apollo-11", "connecting-ridge"
  name: string;
  kind: SiteKind;
  region: SiteRegion;
  lat: number;
  lon: number;
  coordQuality: CoordQuality;
  /** Surface elevation relative to the 1737.4 km reference sphere (LOLA), metres. */
  elevationM?: number;
  /** 2–3 line plain-language story for the public. */
  story: string;
  /** Everything that landed (or will land) here, oldest first. Empty for pure candidates. */
  missions: Mission[];
  /** Extra short labels, e.g. "Moon Base I target (2026) · former Artemis landing candidate (2022)". */
  labels?: string[];
  /** Programmes this place belongs to even without a mission yet (e.g. an Artemis candidate region). */
  programs?: Program[];
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
  azStepDeg: number; // 0.5 → 720 samples (published standard; Mazarico 2011, Barker 2021)
  elevationsDeg: number[];
  /** How far the terrain search reached, km (long reach matters at the pole). */
  maxRangeKm: number;
  /** Observer height above ground used to compute it, metres (e.g. 2 m = lander mast). */
  observerHeightM: number;
  /** 'lola' = real LOLA terrain; 'flat' = no terrain data (all elevations ≈ 0 minus dip). */
  terrain?: 'lola' | 'flat';
  /** DEM layers actually used, nearest first (e.g. 5 m to 5 km, 80 m to 100 km, 240 m beyond). Frame: MEAN_ME (DE421). */
  dem?: { layers: { product: string; resolutionM: number; fromKm: number; toKm: number }[] };
}

/**
 * HORIZON RELIABILITY RULE — engine and UI must match. Use horizonReliability()
 * from '@/shared/horizon' instead of re-implementing it.
 *  - 'lola'                     → 'high'
 *  - 'flat' and |lat| <  80°    → 'medium'
 *  - 'flat' and |lat| ≥  80°    → 'low'   (poles without LOLA terrain; exactly 80° counts as low)
 *  - 'demo'                     → no reliability (the UI shows only the Demo badge)
 * UI label for 'flat':           "Flat horizon · terrain not modelled"
 * …and when |lat| ≥ 80° add:     " · unreliable near the pole"
 * (1 km of height dips the horizon ≈ 1.9°, more than the Sun's highest polar elevation.)
 * Every catalogue site south of 60°S must have a LOLA profile.
 */
export type HorizonSource = 'lola' | 'flat' | 'demo';
export type Reliability = 'high' | 'medium' | 'low';

export interface HorizonInfo {
  source: HorizonSource;
  /** Absent for 'demo'. */
  reliability?: Reliability;
  /** Optional detail, e.g. "coarse terrain grid". */
  note?: string;
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
  /** Which horizon these answers were computed against, and how much to trust it. */
  horizon?: HorizonInfo;
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
  /** Solar energy per day for the chosen Params.panelType, Wh/day (engine). */
  energyWhPerDay?: number;
  /** How matchScore was built — the UI lists these so the score is explainable. */
  scoreBreakdown?: { label: string; points: number; reason: string }[];
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
  /** Solar array type for energy estimates (engine). */
  panelType?: 'vertical-fixed' | 'vertical-rotating' | 'tracking' | 'flat';
  /** Battery limit: longest darkness the mission can survive, hours. */
  maxDarknessH?: number;
  /** Weights for matchScore (engine). */
  scoreWeights: { power: number; comms: number; darkness: number };
  /**
   * WHEN THE LANDER TOUCHES DOWN — the engine judges the site's gates at this moment.
   * Priority: launchTime (+ transitId) > landingTime > the range start.
   * With none of them, metrics.gates.basis comes back 'range-start' (show that in the UI,
   * not a bare 0 score). Same types as the engine's EngineParams.
   */
  /** Launch date chosen by the user; landing = launch + the transit preset. */
  launchTime?: IsoTime;
  /** Engine TRANSIT_PRESETS id: 'apollo-11' (4.28 d), 'im-1' (7.72 d, default), 'blue-ghost-1' (46.1 d). */
  transitId?: string;
  /** Landing moment given directly (e.g. a past mission's real landing). Used only without launchTime. */
  landingTime?: IsoTime;
}

/**
 * Screens: pass a PARTIAL with only the fields you mean to set, e.g.
 *   useMetrics(site, from, to, { launchTime, transitId })
 * Never pass DEFAULT_PARAMS whole — its weights/panel settings would override the engine's.
 */
export const DEFAULT_PARAMS: Params = {
  observerHeightM: 2,
  commsMinClearanceDeg: 0,
  stepMinutes: 60,
  // Agreed with Goda (engine): equal weights, a rotating vertical array, a 150 h battery limit.
  scoreWeights: { power: 1 / 3, comms: 1 / 3, darkness: 1 / 3 },
  panelType: 'vertical-rotating',
  maxDarknessH: 150,
};

// ---------------------------------------------------------------- Constants

export const LUNAR = {
  radiusKm: 1737.4,
  synodicDays: 29.530589, // one lunar day
  /** Period of the Sun's declination cycle as seen from the Moon (eclipse year). */
  solarSeasonDays: 346.62,
  axialTiltDeg: 1.54,
  /**
   * DISPLAY ONLY. The real value varies ≈ 0.524°–0.542° over the year; the engine uses
   * Horizons' per-row angularDiameterDeg instead.
   */
  sunDiameterDeg: 0.53,
} as const;
