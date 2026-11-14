/**
 * 3D terrain tiles for the "stand on site" view — offline export (dev-only, owner: Hagras).
 *
 *   node scripts/terrain/export.mjs                    # every catalogue site we have terrain for
 *   node scripts/terrain/export.mjs connecting-ridge   # one site
 *
 * For each site: a 12 × 12 km grid (radius 6 km) at 20 m spacing, centred on the site,
 * x = east, y = north (azimuthal-equidistant around the site: each grid point is reached along
 * the great circle with bearing atan2(east, north) and distance hypot(east, north) — the same
 * geometry as the horizon rays, so the 3D ground and the horizon file agree).
 * Heights are RELATIVE TO THE SITE, int16 × heightStepM (0.1 m, or 0.2 m for very deep relief),
 * NO curvature (the app applies d²/2R).
 *
 * Output:
 *   public/terrain/<siteId>.i16      601 × 601 int16 little-endian, row 0 = north edge, col 0 = west
 *   src/data/terrain/sites.json      metadata for every exported site (bundled, tiny)
 */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PRODUCTS, covers, destination, loadWindow, project } from '../horizons/dem.mjs';
import { SLDEM_PRODUCT, sldemCovers, sldemWindow } from './sldem.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_BIN = path.join(ROOT, 'public/terrain');
const OUT_META = path.join(ROOT, 'src/data/terrain/sites.json');
const RADIUS_M = 6000;
const SPACING_M = 20;
const N = Math.round((2 * RADIUS_M) / SPACING_M) + 1; // 601
const TIMEOUT_MS = 180_000;
// Polar LOLA maps, finest that comfortably holds the window; coarse local maps as last resort.
const POLAR_ORDER = ['83S_10M', '80S_20M', '75S_30M', '60S_60M', '80S_80M', '60S_240M'];

async function loadCatalogue() {
  const res = await build({
    stdin: { contents: "export { SITE_CATALOGUE } from '@/data/sites';", resolveDir: ROOT, loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    alias: { '@': path.join(ROOT, 'src') },
    logLevel: 'silent',
  });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(res.outputFiles[0].text).toString('base64')}`);
  return mod.SITE_CATALOGUE;
}

const withTimeout = (p, ms, what) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} took longer than ${ms / 1000} s`)), ms))]);

/** A sampler (lat, lon) → height m for the site, from the best source that loads. */
async function samplerFor(site) {
  const margin = RADIUS_M * 1.25;
  if (site.lat < -60) {
    const { x, y } = project(site.lat, site.lon);
    for (const key of POLAR_ORDER) {
      if (!(await covers(key, x, y, margin))) continue;
      try {
        const win = await withTimeout(loadWindow(key, x, y, margin), TIMEOUT_MS, key);
        if (!Number.isFinite(win.sample(x, y))) throw new Error('no data at the site');
        // Gaps in the fine map are filled from the cached coarse maps (never with a made-up value).
        const coarse = [];
        for (const k of ['80S_80M', '60S_240M']) {
          if (k !== key && (await covers(k, x, y, margin))) coarse.push(await loadWindow(k, x, y, margin));
        }
        const sample = (lat, lon) => {
          const q = project(lat, lon);
          let h = win.sample(q.x, q.y);
          for (const c of coarse) if (!Number.isFinite(h)) h = c.sample(q.x, q.y);
          return h;
        };
        return { sample, product: PRODUCTS[key].product, resolutionM: win.res };
      } catch (e) {
        console.warn(`  ! ${site.id}: ${key} failed (${e.message}) — falling back`);
      }
    }
    return null;
  }
  if (sldemCovers(site.lat, RADIUS_M * 1.25)) {
    const win = await sldemWindow(site.lat, site.lon, margin);
    return { sample: win.sample, product: SLDEM_PRODUCT, resolutionM: win.resolutionM };
  }
  return null;
}

async function exportSite(site) {
  const t0 = Date.now();
  const src = await samplerFor(site);
  if (!src) return null;
  const h0 = src.sample(site.lat, site.lon);
  if (!Number.isFinite(h0)) throw new Error(`${site.id}: no height at the site`);
  const rel = new Float32Array(N * N);
  let nan = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let r = 0; r < N; r++) {
    const north = RADIUS_M - r * SPACING_M;
    for (let c = 0; c < N; c++) {
      const east = -RADIUS_M + c * SPACING_M;
      const d = Math.hypot(east, north);
      const p = d === 0 ? { lat: site.lat, lon: site.lon } : destination(site.lat, site.lon, (Math.atan2(east, north) * 180) / Math.PI, d / 1737400);
      let h = src.sample(p.lat, p.lon);
      if (!Number.isFinite(h)) {
        nan++;
        h = h0;
      }
      const v = h - h0;
      min = Math.min(min, v);
      max = Math.max(max, v);
      rel[r * N + c] = v;
    }
  }
  // Height step: 0.1 m normally; coarser only when the relief would not fit in int16 (deep craters).
  const span = Math.max(Math.abs(min), Math.abs(max));
  const heightStepM = span <= 3276.7 ? 0.1 : span <= 6553.4 ? 0.2 : 0.5;
  const grid = new Int16Array(N * N);
  for (let i = 0; i < grid.length; i++) grid[i] = Math.round(rel[i] / heightStepM);
  await mkdir(OUT_BIN, { recursive: true });
  await writeFile(path.join(OUT_BIN, `${site.id}.i16`), Buffer.from(grid.buffer));
  return {
    siteId: site.id,
    lat: site.lat,
    lon: site.lon,
    n: N,
    spacingM: SPACING_M,
    radiusM: RADIUS_M,
    siteHeightM: Math.round(h0 * 10) / 10,
    minRelM: Math.round(min),
    maxRelM: Math.round(max),
    product: src.product,
    resolutionM: src.resolutionM,
    noDataFraction: Math.round((nan / (N * N)) * 10000) / 10000,
    heightStepM,
    computeSeconds: Math.round((Date.now() - t0) / 100) / 10,
    generatedAt: new Date().toISOString(),
  };
}

async function main() {
  const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const catalogue = await loadCatalogue();
  const sites = catalogue.filter((s) => wanted.length === 0 || wanted.includes(s.id));
  let meta = {};
  try {
    meta = JSON.parse(await readFile(OUT_META, 'utf8'));
  } catch {
    /* first run */
  }
  for (const s of sites) {
    try {
      const m = await exportSite(s);
      if (!m) {
        console.log(`– ${s.id.padEnd(24)} no terrain source covers it (kept as placeholder)`);
        continue;
      }
      meta[s.id] = m;
      await mkdir(path.dirname(OUT_META), { recursive: true });
      await writeFile(OUT_META, JSON.stringify(meta, null, 1));
      console.log(
        `✓ ${s.id.padEnd(24)} ${String(m.resolutionM).padStart(3)} m  relief ${m.minRelM}…${m.maxRelM} m  nodata ${(m.noDataFraction * 100).toFixed(1)}%  ${m.computeSeconds}s  step ${m.heightStepM} m`,
      );
    } catch (e) {
      console.log(`✗ ${s.id}: ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
