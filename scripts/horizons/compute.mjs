/**
 * LOLA horizon profiles — offline generator (dev-only, owner: Hagras).
 *
 *   node scripts/horizons/compute.mjs                 # every catalogue site south of 60°S
 *   node scripts/horizons/compute.mjs connecting-ridge haworth
 *   node scripts/horizons/compute.mjs --validation    # Gläser 2018 points S and C1 at 0 m and 2 m
 *
 * Method (agreed with Goda; Barker 2021 nesting, Barker 2023 reach):
 *  - 720 azimuths (0.5°), geographic: clockwise from lunar north.
 *  - March along the great circle from the site; for each terrain sample
 *      e = atan2(r_t·cos γ − r_o, r_t·sin γ),  r_o = R + h_site + observer, r_t = R + h(point)
 *    and keep the maximum → curvature is exact (3-D, spherical Moon of R = 1737.4 km).
 *  - Nested DEMs: finest available to 3 km, 80 m (or 60 m) to 100 km, 240 m to 310 km.
 *    A fine map that is refused or slower than 3 min falls back to the next coarser one.
 *  - Heights: float32 metres above the 1737.4 km sphere, NaN = no data (skipped).
 * Output: src/data/horizons-lola/<siteId>.json matching HorizonProfile (+ `meta`).
 */
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { R_MOON, PRODUCTS, covers, destination, loadWindow, project, stats } from './dem.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'src/data/horizons-lola');
const OUT_VALIDATION = path.join(ROOT, 'scripts/horizons/validation');
const AZ_STEP = 0.5;
const OBSERVER_M = 2;
const NEAR_KM = 3; // fine terrain matters most close by; 80 m beyond (keeps NASA requests small)
const FINE_TIMEOUT_MS = 180_000; // give up on a slow fine map after 3 min and fall back
const MID_KM = 100;
const MAX_KM = 310;
const NEAR_ORDER = ['87S_5M', '83S_10M', '80S_20M', '75S_30M', '60S_60M'];
const MID_ORDER = ['80S_80M', '60S_60M'];
const FAR = '60S_240M';

/** Load the site catalogue straight from the app's TypeScript (one source of truth). */
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

/**
 * Load the finest product in `order` that covers the window AND actually loads.
 * If one fails (server refusal, timeout, no data at the site), fall back to the next one.
 */
async function loadFirstWorking(order, x, y, km, label, id) {
  for (const key of order) {
    if (!(await covers(key, x, y, km * 1000))) continue;
    try {
      const t = Date.now();
      console.log(`  … ${id}: loading ${label} ${key}`);
      const win = await Promise.race([
        loadWindow(key, x, y, km * 1000),
        new Promise((_, reject) => setTimeout(() => reject(new Error('took longer than 3 min')), FINE_TIMEOUT_MS)),
      ]);
      console.log(`    ${key} ready in ${((Date.now() - t) / 1000).toFixed(0)} s`);
      if (!Number.isFinite(win.sample(x, y))) throw new Error('no data at the site');
      return { win, key };
    } catch (e) {
      console.warn(`  ! ${id}: ${label} ${key} failed (${e.message}) — falling back`);
    }
  }
  throw new Error(`${id}: no DEM could be loaded for the ${label} field`);
}

async function horizon({ id, lat, lon }, observerM) {
  const { x, y } = project(lat, lon);
  const t0 = Date.now();
  // Fine maps are read remotely; the final fallbacks are the locally cached coarse maps.
  const { win: near, key: nearKey } = await loadFirstWorking([...NEAR_ORDER, '80S_80M', FAR], x, y, NEAR_KM + 1, 'near', id);
  const { win: mid, key: midKey } = await loadFirstWorking([...MID_ORDER, FAR], x, y, MID_KM + 2, 'mid', id);
  const far = await loadWindow(FAR, x, y, (MAX_KM + 5) * 1000);

  const hSite = near.sample(x, y);
  if (!Number.isFinite(hSite)) throw new Error(`${id}: no DEM height at the site`);
  const rO = R_MOON + hSite + observerM;

  // Distance rings: [fromKm, toKm, layer]
  const rings = [
    [2 * near.res / 1000, NEAR_KM, near],
    [NEAR_KM, MID_KM, mid],
    [MID_KM, MAX_KM, far],
  ];
  const n = Math.round(360 / AZ_STEP);
  const elevationsDeg = new Array(n);
  let reach = 0;
  let nanSamples = 0;
  let totalSamples = 0;
  for (let i = 0; i < n; i++) {
    const az = i * AZ_STEP;
    let best = -Math.PI / 2;
    for (const [fromKm, toKm, layer] of rings) {
      const step = layer.res;
      for (let s = fromKm * 1000; s <= toKm * 1000; s += step) {
        const gamma = s / R_MOON;
        const p = destination(lat, lon, az, gamma);
        const q = project(p.lat, p.lon);
        const h = layer.sample(q.x, q.y);
        totalSamples++;
        if (!Number.isFinite(h)) {
          nanSamples++;
          continue;
        }
        reach = Math.max(reach, s);
        const rT = R_MOON + h;
        const e = Math.atan2(rT * Math.cos(gamma) - rO, rT * Math.sin(gamma));
        if (e > best) best = e;
      }
    }
    elevationsDeg[i] = Math.round((best * 180) / Math.PI * 1000) / 1000;
  }

  return {
    source: 'lola',
    siteId: id,
    azStepDeg: AZ_STEP,
    elevationsDeg,
    maxRangeKm: Math.round(reach / 100) / 10,
    observerHeightM: observerM,
    terrain: 'lola',
    dem: {
      layers: [
        { product: PRODUCTS[nearKey].product, resolutionM: near.res, fromKm: 0, toKm: NEAR_KM },
        { product: PRODUCTS[midKey].product, resolutionM: mid.res, fromKm: NEAR_KM, toKm: MID_KM },
        { product: PRODUCTS[FAR].product, resolutionM: far.res, fromKm: MID_KM, toKm: MAX_KM },
      ],
    },
    meta: {
      lat,
      lon,
      siteHeightM: Math.round(hSite * 10) / 10,
      frame: 'MOON_ME (DE421), heights above the 1737.4 km sphere',
      method: 'max elevation angle along 720 great-circle rays; e = atan2(r_t cosγ − r_o, r_t sinγ)',
      noDataFraction: Math.round((nanSamples / totalSamples) * 10000) / 10000,
      computeSeconds: Math.round((Date.now() - t0) / 100) / 10,
      generatedAt: new Date().toISOString(),
      sources: 'NASA PGDA products 81 and 90 (Barker et al. 2021, 2023)',
    },
  };
}

const VALIDATION_POINTS = [
  { id: 'glaser-S', lat: -89.7849, lon: -156.03 }, // Gläser et al. 2018, Shackleton rim "S"
  { id: 'glaser-C1', lat: -89.4505, lon: -137.16 }, // Gläser et al. 2018, Connecting Ridge "C1"
];

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--validation')) {
    await mkdir(OUT_VALIDATION, { recursive: true });
    for (const p of VALIDATION_POINTS) {
      for (const h of [0, 2]) {
        const prof = await horizon(p, h);
        const file = path.join(OUT_VALIDATION, `${p.id}_${h}m.json`);
        await writeFile(file, JSON.stringify(prof));
        console.log(`✓ ${p.id} @ ${h} m  max ${Math.max(...prof.elevationsDeg).toFixed(2)}°  → ${path.relative(ROOT, file)}`);
      }
    }
    return;
  }
  const catalogue = await loadCatalogue();
  const wanted = args.filter((a) => !a.startsWith('--'));
  const sites = catalogue.filter((s) => s.lat < -60 && (wanted.length === 0 || wanted.includes(s.id)));
  await mkdir(OUT, { recursive: true });
  for (const s of sites) {
    const prof = await horizon(s, OBSERVER_M);
    await writeFile(path.join(OUT, `${s.id}.json`), JSON.stringify(prof));
    const layers = prof.dem.layers.map((l) => `${l.resolutionM}m`).join('/');
    console.log(
      `✓ ${s.id.padEnd(22)} near/mid/far ${layers.padEnd(11)} h=${prof.meta.siteHeightM} m  ` +
        `horizon ${Math.min(...prof.elevationsDeg).toFixed(2)}…${Math.max(...prof.elevationsDeg).toFixed(2)}°  ` +
        `reach ${prof.maxRangeKm} km  nodata ${(prof.meta.noDataFraction * 100).toFixed(2)}%  ${prof.meta.computeSeconds}s`,
    );
  }
  console.log(`requests ${stats.requests}, retries ${stats.retries}${stats.lastStatus ? ` (last refusal HTTP ${stats.lastStatus})` : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
