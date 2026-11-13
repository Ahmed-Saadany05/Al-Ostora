/**
 * Sanity check: average sunlight from our LOLA horizons vs NASA's own map (PGDA 69, Mazarico,
 * AVGVISIB = mean visible fraction of the solar disc over 18.6 years, surface, 0 m).
 *
 * Our side uses a simple Sun path (sub-solar latitude ±1.54° over 346.62 d, one turn per
 * 29.53 d) and the disc-fraction rule, at the files' 2 m height → expect ours ≥ NASA's and
 * only a rough match. This is a sanity check, not the engine's validation.
 *   node scripts/horizons/check-sunlight.mjs
 */
import { fromFile } from 'geotiff';
import { readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { project } from './dem.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = path.join(ROOT, 'src/data/horizons-lola');
const CACHE = process.env.REFAEY_DEM_CACHE ?? path.join(os.homedir(), '.refaey-dem-cache');
const MAPS = ['AVGVISIB_85S_060M_201608.TIF', 'AVGVISIB_75S_120M_201608.TIF']; // finest first
const SCALE = 0.00004; // PDS label: AVERAGE_VISIBILITY = DN × 0.00004
const DEG = Math.PI / 180;
const SUN_R = 0.265; // deg

async function nasaValue(lat, lon) {
  const { x, y } = project(lat, lon);
  for (const f of MAPS) {
    const img = await (await fromFile(path.join(CACHE, f))).getImage(0);
    const [ox, oy] = img.getOrigin();
    const [rx, ry] = img.getResolution();
    const c = Math.floor((x - ox) / rx);
    const r = Math.floor((y - oy) / ry);
    if (c < 0 || r < 0 || c >= img.getWidth() || r >= img.getHeight()) continue;
    const [d] = await img.readRasters({ window: [c, r, c + 1, r + 1] });
    return { value: d[0] * SCALE, map: f.slice(9, 17) };
  }
  return null;
}

const disc = (clear) => {
  if (clear >= SUN_R) return 1;
  if (clear <= -SUN_R) return 0;
  const u = clear / SUN_R;
  return 1 - (Math.acos(u) - u * Math.sqrt(1 - u * u)) / Math.PI;
};

function ours(p) {
  const e = p.elevationsDeg;
  const lat = p.meta.lat * DEG;
  let sum = 0;
  let n = 0;
  for (let h = 0; h < 24 * 346.62 * 3; h++) {
    const d = h / 24;
    const sl = 1.54 * Math.sin((2 * Math.PI * d) / 346.62) * DEG;
    const dl = ((-360 * d) / 29.530589 - p.meta.lon) * DEG;
    const el = Math.asin(Math.sin(lat) * Math.sin(sl) + Math.cos(lat) * Math.cos(sl) * Math.cos(dl)) / DEG;
    let az = Math.atan2(Math.sin(dl) * Math.cos(sl), Math.cos(lat) * Math.sin(sl) - Math.sin(lat) * Math.cos(sl) * Math.cos(dl)) / DEG;
    az = (az + 360) % 360;
    const i = Math.round(az / p.azStepDeg) % e.length;
    sum += disc(el - e[i]);
    n++;
  }
  return sum / n;
}

const rows = [];
for (const f of (await readdir(DIR)).filter((x) => x.endsWith('.json')).sort()) {
  const p = JSON.parse(await readFile(path.join(DIR, f), 'utf8'));
  const nasa = await nasaValue(p.meta.lat, p.meta.lon);
  rows.push({ site: p.siteId, near: `${p.dem.layers[0].resolutionM} m`, nasa, ours: ours(p) });
}
console.log('site                      near   NASA avg sun   ours (rough, 2 m)   diff');
for (const r of rows) {
  const nasa = r.nasa ? `${(r.nasa.value * 100).toFixed(0).padStart(3)}% (${r.nasa.map})` : '   n/a        ';
  const diff = r.nasa ? `${((r.ours - r.nasa.value) * 100).toFixed(0).padStart(4)} pts` : '';
  console.log(`${r.site.padEnd(25)} ${r.near.padEnd(6)} ${nasa.padEnd(15)} ${`${(r.ours * 100).toFixed(0)}%`.padStart(6)}            ${diff}`);
}
