/**
 * Site grading for "Plan a Future Mission" (ENGINE_SPEC.md §7, decided):
 *  - Slope: GATE, < 10° over a 100 m baseline (NASA crewed-landing rule).
 *  - Hazards (PSR, LOLA roughness): warnings, not gates.
 *  - Distance to the science target: pass/fail WARNING at ~2 km walk-back
 *    (NASA planning value, TBR). Not a gate, no partial points.
 * Missing data never fails a gate; it is listed as "no data".
 */
import { SLOPE_BASELINE_M, SLOPE_GATE_DEG, WALKBACK_KM } from './constants';
import { haversineKm } from './geometry';
import type { GradeInput, GradeLine, SiteGrade } from './types';

export const LESSONS = {
  slope:
    'IM-1 (2024) came to rest on a ~12° slope and tipped over. Apollo landers were rated for about 12°.',
  approach:
    "IM-2 (2025) landed about 250 m off target in a crater, with a noisy altimeter and a low Sun.",
  boulders: 'Apollo 11: Armstrong flew past the boulder field around West crater before landing.',
};

export function gradeSite(g: GradeInput): SiteGrade {
  const lines: GradeLine[] = [];

  // Slope gate
  if (g.slopeDeg100m === undefined) {
    lines.push({ id: 'slope', kind: 'gate', ok: null, text: `No slope data (needs a ${SLOPE_BASELINE_M} m slope map)` });
  } else {
    const ok = g.slopeDeg100m < SLOPE_GATE_DEG;
    lines.push({
      id: 'slope',
      kind: 'gate',
      ok,
      text: ok
        ? `Slope ${g.slopeDeg100m.toFixed(1)}° over ${SLOPE_BASELINE_M} m: under NASA's ${SLOPE_GATE_DEG}° limit for crewed landings`
        : `Slope ${g.slopeDeg100m.toFixed(1)}° over ${SLOPE_BASELINE_M} m: too steep (NASA limit ${SLOPE_GATE_DEG}°)`,
      lesson: ok ? undefined : LESSONS.slope,
    });
  }

  // Distance: pass/fail warning
  const distanceKm = haversineKm(g.site.lat, g.site.lon, g.target.lat, g.target.lon);
  const near = distanceKm <= WALKBACK_KM;
  lines.push({
    id: 'distance',
    kind: 'warning',
    ok: near,
    text: near
      ? `${fmtKm(distanceKm)} from ${g.target.name}: reachable on foot`
      : `${fmtKm(distanceKm)} from ${g.target.name}: needs a rover; beyond the ~${WALKBACK_KM} km walk-back limit (NASA planning value, TBR)`,
  });

  // Hazard warnings
  if (g.inPsr !== undefined)
    lines.push({
      id: 'psr',
      kind: 'warning',
      ok: !g.inPsr,
      text: g.inPsr
        ? 'Inside a permanently shadowed region: no sunlight for power, very cold'
        : 'Not in a permanently shadowed region',
    });
  if (g.roughnessHigh !== undefined)
    lines.push({
      id: 'roughness',
      kind: 'warning',
      ok: !g.roughnessHigh,
      text: g.roughnessHigh ? 'Rough terrain (LOLA roughness): rocks and small craters likely' : 'Terrain roughness looks low',
      lesson: g.roughnessHigh ? LESSONS.boulders : undefined,
    });

  const passes = !lines.some((l) => l.kind === 'gate' && l.ok === false);
  return { passes, distanceKm, lines };
}

const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
