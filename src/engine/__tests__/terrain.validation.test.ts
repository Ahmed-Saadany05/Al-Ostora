/**
 * TERRAIN CHECK (opt-in): engine over a full year on real LOLA horizons vs NASA PGDA
 * product 69 long-term values. Calls JPL Horizons through our proxy handler (≈ 26 requests).
 *
 *   RUN_TERRAIN=1 npx vitest run src/engine/__tests__/terrain.validation.test.ts
 *   (optional) TERRAIN_REPORT=/path/report.md  — also write the table as Markdown
 *
 * REPORT ONLY: no pass/fail tolerance yet (not decided). It is approximate by nature:
 * PGDA 69 = 18.6-yr hourly average, surface (0 m), 60 m DEM, any-part visibility; the
 * engine = one year (13 Nov 2026 → 13 Nov 2027), 2 m observer, Hagras's horizon files.
 * Reference values: research_notes/.../site_reference_values.md (60 m, nearest pixel).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { handleHorizons } from '../../../api/_lib/horizons-handler';
import type { HorizonsQuery, HorizonsResponse } from '@/data/horizons/types';
import { SITE_CATALOGUE } from '@/data/sites';
import type { HorizonProfile } from '@/shared/types';
import { haversineKm } from '../geometry';
import { createLiveProvider } from '../provider';

const ROOT = join(__dirname, '../../..');
const LOLA_DIR = join(ROOT, 'src/data/horizons-lola');
const FIXTURE_DIR = join(ROOT, 'src/data/horizons/fixtures');
const FROM = '2026-11-13T00:00:00Z';
const TO = '2027-11-13T00:00:00Z';
/** Catalogue point farther than this from the reference point → not like-for-like. */
const SAME_POINT_M = 30;

const REFERENCES = [
  { siteId: 'connecting-ridge', label: 'Connecting Ridge R01', lat: -89.4632, lon: -137.49, sunPct: 43.87, earthPct: 39.05,
    note: 'Sun value unstable across map resolutions (60 m 43.9 / 120 m 66.3 / 240 m 67.9)' },
  { siteId: 'shackleton-rim', label: 'Shackleton Rim R04', lat: -89.7668, lon: -171.87, sunPct: 10.96, earthPct: 11.07 },
  { siteId: 'im-2-athena', label: 'IM-2 Athena', lat: -84.7906, lon: 29.1957, sunPct: 45.1, earthPct: 92.08 },
  { siteId: 'de-gerlache-rim-2', label: 'de Gerlache Rim 2 (SL2)', lat: -88.23, lon: -64.6284, sunPct: 37.3, earthPct: 54.78 },
];

async function fetchViaHandler(q: HorizonsQuery): Promise<HorizonsResponse> {
  const p = new URLSearchParams({
    target: q.target, lat: String(q.lat), lon: String(q.lon), altKm: String(q.altKm ?? 0),
    start: q.start, stop: q.stop, step: q.step,
  });
  const res = await handleHorizons(new Request(`http://localhost/api/horizons?${p}`));
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as HorizonsResponse;
}

const readJson = <T,>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

describe.skipIf(!process.env.RUN_TERRAIN)('terrain check: engine (1 yr, LOLA) vs PGDA 69 (18.6 yr)', () => {
  it('reports sunlit and Earth-in-view % per reference site', async () => {
    const provider = createLiveProvider({
      fetcher: fetchViaHandler,
      loadProfile: async (id) => {
        const f = join(LOLA_DIR, `${id}.json`);
        return existsSync(f) ? readJson<HorizonProfile>(f) : null;
      },
      loadRecorded: async () =>
        existsSync(FIXTURE_DIR)
          ? readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json')).map((f) => readJson<HorizonsResponse>(join(FIXTURE_DIR, f)))
          : [],
      listSites: async () => SITE_CATALOGUE,
    });

    const rows: string[] = [];
    for (const ref of REFERENCES) {
      const site = SITE_CATALOGUE.find((s) => s.id === ref.siteId);
      if (!site) {
        rows.push(`| ${ref.label} | – | – | – | – | not in catalogue |`);
        continue;
      }
      const horizon = await provider.getHorizon(site);
      if (horizon.terrain !== 'lola') {
        rows.push(`| ${ref.label} | – | ${ref.sunPct} | – | ${ref.earthPct} | no LOLA horizon file yet |`);
        continue;
      }
      const offM = haversineKm(site.lat, site.lon, ref.lat, ref.lon) * 1000;
      const m = await provider.getMetrics(site, FROM, TO);
      expect(m.sunlitFraction).toBeGreaterThanOrEqual(0);
      expect(m.sunlitFraction).toBeLessThanOrEqual(1);
      const sun = 100 * m.sunlitFraction;
      const earth = 100 * m.earthVisibleFraction;
      const notes = [
        offM > SAME_POINT_M ? `NOT LIKE-FOR-LIKE: catalogue point is ${Math.round(offM)} m from the reference point` : '',
        ref.note ?? '',
      ].filter(Boolean).join('; ');
      rows.push(
        `| ${ref.label} | ${sun.toFixed(1)} | ${ref.sunPct} | ${earth.toFixed(1)} | ${ref.earthPct} | ` +
          `Δsun ${(sun - ref.sunPct).toFixed(1)} pp, Δearth ${(earth - ref.earthPct).toFixed(1)} pp${notes ? `; ${notes}` : ''} |`,
      );
    }

    const report = [
      `Terrain check, ${FROM.slice(0, 10)} → ${TO.slice(0, 10)}, run ${new Date().toISOString()}`,
      '',
      '| Site | Engine Sun % | PGDA 69 Sun % | Engine Earth % | PGDA 69 Earth % | Notes |',
      '|---|---|---|---|---|---|',
      ...rows,
      '',
      'Approximate by nature: PGDA 69 is an 18.6-year surface average on a 60 m map; the engine is one year at 2 m.',
    ].join('\n');
    console.log(`\n${report}\n`);
    if (process.env.TERRAIN_REPORT) writeFileSync(process.env.TERRAIN_REPORT, report);
  }, 600_000);
});
