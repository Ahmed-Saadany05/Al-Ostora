/**
 * Engine-local types. They EXTEND the shared contract (src/shared/types.ts, owner Hagras)
 * with fields the spec needs but the contract doesn't have yet. See HAGRAS_NOTE.md: once
 * these move into shared/types.ts, this file shrinks to re-exports.
 */
import type { HorizonsRow } from '@/data/horizons/types';
import type { IsoTime, Params, SiteMetrics, SkyState } from '@/shared/types';

/** Proxy row plus quantity 10 (Earth illuminated %), which the proxy will add. */
export type EphemerisRow = HorizonsRow & { illuminationPct?: number };

export type PanelType = NonNullable<Params['panelType']>;

export interface EngineParams extends Params {
  panelType: PanelType;
  maxDarknessH: number;
  /** Facing direction for 'vertical-fixed' panels, degrees from north. Required for that type. */
  panelAzimuthDeg?: number;
  /**
   * Launch date the player picked (decided: gates are judged at launch + transit time).
   * Takes priority over `landingTime`.
   */
  launchTime?: IsoTime;
  /** Transit preset id for `launchTime` (default IM-1, 7.72 d). */
  transitId?: string;
  /** Landing time given directly (e.g. past missions). Used only when `launchTime` is absent. */
  landingTime?: IsoTime;
}

export type EclipseState = 'none' | 'partial' | 'total';

/** SkyState plus what the spec adds. */
export interface EngineSkyState extends SkyState {
  /** Set when the answer is not for the requested time (offline, outside recorded data). */
  requestedTime?: IsoTime;
  fallback?: 'nearest-recorded';
  /** Earth in front of the Sun, seen from the site (Horizons' daylight flag ignores this). */
  eclipse: EclipseState;
  /** Share of the solar disk above the terrain, ignoring the eclipse (0–1). */
  sunTerrainFraction: number;
}

export interface ScoreLine {
  label: string;
  points: number;
  reason: string;
}

export interface EngineMetrics extends SiteMetrics {
  energyWhPerDay: number;
  /** Energy of the chosen panel as a % of a two-axis tracking panel at the same site/time. */
  relativeEnergyPct: number;
  panelType: PanelType;
  scoreBreakdown: ScoreLine[];
  darknessScore: number;
  /** Must-pass gates judged at `landingTime`. */
  gates: {
    sunAtLanding: boolean;
    earthAtLanding: boolean;
    landingTime: IsoTime;
    /** How landingTime was found. 'range-start' = no launch/landing given; the UI should say so. */
    basis: 'launch+transit' | 'landing-time' | 'range-start';
  };
  /** Things not modelled, for the UI's fine print. */
  notModelled: string[];
}

export interface TransitPreset {
  id: string;
  label: string;
  days: number;
  kind: string;
}

// ---------------------------------------------------------------- site grading

export interface GradeInput {
  site: { lat: number; lon: number; name?: string };
  target: { lat: number; lon: number; name: string };
  /** Plane-fit slope over a 100 m baseline (PGDA product 90), degrees. Omit if unknown. */
  slopeDeg100m?: number;
  /** Site lies in a permanently shadowed region (PGDA 90 PSR map). */
  inPsr?: boolean;
  /** LOLA roughness flagged high by the data layer. */
  roughnessHigh?: boolean;
}

export interface GradeLine {
  id: 'slope' | 'distance' | 'psr' | 'roughness';
  kind: 'gate' | 'warning' | 'info';
  ok: boolean | null; // null = no data
  text: string;
  lesson?: string;
}

export interface SiteGrade {
  /** False only when a gate fails. Unknown data never fails a gate, but is listed. */
  passes: boolean;
  distanceKm: number;
  lines: GradeLine[];
}
