# engine/ — owner: Goda

The science engine: Sun and Earth against the terrain horizon, visibility windows, eclipses, power, scores and site grading.

## Use

```ts
import '@/engine'; // registers the live provider (needs one import, e.g. in main.tsx)
```

Then run with `VITE_DATA_PROVIDER=live npm run dev`. Extra exports: `gradeSite`, `TRANSIT_PRESETS`, `ENGINE_DEFAULTS`, and the types in `types.ts`.

Tests: `npm test` (vitest; validation against recorded JPL Horizons output).

## Files

| File | What |
|---|---|
| `track.ts` | One body's Horizons rows, interpolated as ENU unit vectors (cubic Hermite). Distance, diameter and illumination are interpolated linearly. |
| `ephemeris.ts` | Cache: one proxy request per body per 30-day chunk (1 h step, padded). Offline, it falls back to `src/data/horizons/fixtures/*.json`. |
| `horizon.ts` | Loads the LOLA profile `src/data/horizons-lola/<site.id>.json`. Without one, it uses a flat sphere horizon dipped for 2 m (0.0869°), labelled flat. |
| `visibility.ts` | Horizon lookup, disk fraction above the skyline, eclipse state, and the Sun fraction with Earth in front. |
| `sky.ts` | One instant → `SkyState` (+ `eclipse`, `sunTerrainFraction`). |
| `analysis.ts` | 10-min scan with edges refined by bisection (±15 s): windows, metrics, power, scores, breakdown. |
| `grading.ts` | Site grading for "Plan a Future Mission". |
| `provider.ts` | `createLiveProvider(deps)`, the `DataProvider` implementation. |

## Definitions and decisions (ENGINE_SPEC.md, decided 2026-11-13)

- **Sun up** = any part of the solar disk above the terrain AND not fully behind Earth. Totality counts as night. A partial eclipse only lowers `visibleFraction`.
- **Earth in view** = any part of Earth's disk above the terrain. `commsMinClearanceDeg` applies to the top of the disk; the default is 0.
- **Scores (0–100)**:
  - power = sunlit fraction × 100
  - comms = Earth-in-view fraction × 100
  - darkness = clamp(1 − longestNight / maxDarknessH, 0, 1) × 100
  - match = weighted mean (⅓ each by default)
  - Must-pass gates: Sun AND Earth at landing. If either fails, match = 0 and the breakdown gives the reason.
  - Landing (decided): the player picks a **launch date**. Pass `launchTime` (+ optional `transitId`, default IM-1) and the gates are judged at launch + transit.
    - `landingTime` can be given directly instead, e.g. for past missions.
    - With neither, the gates use `from`, and `gates.basis = 'range-start'` so the UI can say so.
- **Energy**:
  - Wh per m² of panel per day: 1360.8 W/m² × (1 AU/r)² × 30.7 % × visibleFraction × cos(incidence)
  - default panel `vertical-rotating`
  - `relativeEnergyPct` = the chosen panel's energy vs a tracking panel
  - Dust, scattered light and ground stations are not modelled.
- **planLaunch**: real transit presets, default IM-1 7.72 d. Apollo 11 4.28 d and Blue Ghost 1 46.1 d are selectable by id.
- **Grading**:
  - Slope < 10° over 100 m is a gate.
  - PSR and roughness are warnings.
  - Distance > 2 km is a warning ("NASA planning value, TBR"), never a gate.
  - Missing data never fails a gate; it is listed as "no data".
- **Observer height** is fixed at 2 m. Horizons is queried at site elevation + 2 m.
- **Offline**:
  - `getSky` returns the nearest recorded state with `requestedTime` and `fallback: 'nearest-recorded'`.
  - `getMetrics` and `getDayReport` throw a clear error if any part of the range has no data. They never guess.

## Validation (`__tests__/horizons.validation.test.ts`)

| Check | Result |
|---|---|
| Hourly rows interpolated to every minute vs Horizons (Sun, Earth, R01) | ≤ 0.01° on-sky |
| Sun–Earth separation vs Horizons T-O-I, eclipse 2026-08-28 at R01 | ≤ 0.001° |
| Totality at R01, 2026-08-28 (reference 02:59–05:34) | 02:58:53–05:34:23 |
| Partial phase (reference 01:53–06:40) | ±2 min |
| Sun fraction during the eclipse vs a brute-force count on the sphere | ≤ 0.002 |
| Apollo 11/12/16/17 Sun elevation vs Scotti & Fjeld | ±0.1° |

On a flat horizon, darkness at R01 on 2026-08-28 lasts 02:49–05:47. That's longer than totality, because Earth covers the upper crescent while the lower part of the Sun is below the horizon.

Fixture provenance: `__tests__/fixtures/*.json` (field `source`) were converted from the research Horizons cache. The eclipse fixture has no range column, so tests use placeholder distances and never assert power from it.
