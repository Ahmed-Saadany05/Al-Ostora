/**
 * Engine constants. Every number here is a decision recorded in ENGINE_SPEC.md or a
 * sourced physical value; the comment says which.
 */
import { LUNAR } from '@/shared/types';
import type { EngineParams, TransitPreset } from './types';

/** Mean lunar radius of the reference sphere, km (LOLA / IAU, same as LUNAR.radiusKm). */
export const MOON_RADIUS_KM = LUNAR.radiusKm;

/** Astronomical unit, km (IAU 2012). */
export const AU_KM = 149_597_870.7;

/** Total solar irradiance at 1 AU, W/m² (Kopp & Lean 2011, 1360.8 ± 0.5). */
export const SOLAR_CONSTANT_W_M2 = 1360.8;

/** Solar cell efficiency (Spectrolab XTJ Prime, beginning of life datasheet; SINGLE SOURCE). */
export const PANEL_EFFICIENCY = 0.307;

/** Observer height used everywhere (decided: 2 m only, no slider). */
export const OBSERVER_HEIGHT_M = 2;

/**
 * Internal scan step for windows and metrics, minutes. Every transition found on this
 * grid is then refined by bisection to REFINE_TOLERANCE_S.
 */
export const SCAN_STEP_MIN = 10;
export const REFINE_TOLERANCE_S = 15;

/** Horizons request chunk (days) and step. Interpolation error at 1 h is checked in tests. */
export const CHUNK_DAYS = 30;
export const CHUNK_STEP = '1h';
export const CHUNK_STEP_MIN = 60;

/** Engine defaults (decided 2026-11-13). DEFAULT_PARAMS in shared/types still says 0.4/0.3/0.3. */
export const ENGINE_DEFAULTS: EngineParams = {
  observerHeightM: OBSERVER_HEIGHT_M,
  commsMinClearanceDeg: 0,
  stepMinutes: 60,
  panelType: 'vertical-rotating',
  /** NASA Lunar Surface Data Book M2M-30044 default; "not necessarily conservative". */
  maxDarknessH: 150,
  scoreWeights: { power: 1 / 3, comms: 1 / 3, darkness: 1 / 3 },
};

/** Real launch → landing durations (decided). Default: IM-1. */
export const TRANSIT_PRESETS: readonly TransitPreset[] = [
  { id: 'apollo-11', label: 'Apollo 11 (1969)', days: 4.28, kind: 'direct crewed transfer' },
  { id: 'im-1', label: 'IM-1 Odysseus (2024)', days: 7.72, kind: 'robotic lander, direct transfer' },
  { id: 'blue-ghost-1', label: 'Blue Ghost 1 (2025)', days: 46.1, kind: 'low-energy transfer' },
];
export const DEFAULT_TRANSIT_ID = 'im-1';

export function transitPreset(id = DEFAULT_TRANSIT_ID): TransitPreset {
  const p = TRANSIT_PRESETS.find((t) => t.id === id);
  if (!p) throw new Error(`Unknown transit preset "${id}"`);
  return p;
}

/** Landing = launch + preset transit (decided: the player picks the launch date). */
export const landingMsFromLaunch = (launchMs: number, transitId?: string) =>
  launchMs + transitPreset(transitId).days * 86_400_000;

/** Site grading (decided). */
export const SLOPE_GATE_DEG = 10;
export const SLOPE_BASELINE_M = 100;
export const WALKBACK_KM = 2;
