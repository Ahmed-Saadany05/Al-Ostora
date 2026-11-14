/**
 * DEM access for the horizon script (dev-only, owner: Hagras).
 *
 * NASA PGDA LOLA products are cloud-optimized GeoTIFFs: float32 metres above the
 * 1737.4 km sphere (NaN = no data), south polar stereographic, true scale at the pole,
 * MOON_ME / DE421. We read only the tiles we need via HTTP range requests.
 */
import { fromFile, fromUrl } from 'geotiff';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Coarse maps are downloaded once (download.mjs) and read locally; fine maps are read remotely. */
export const CACHE_DIR = process.env.REFAEY_DEM_CACHE ?? path.join(os.homedir(), '.refaey-dem-cache');
export const LOCAL_KEYS = ['80S_80M', '60S_240M'];
export const localPath = (key) => path.join(CACHE_DIR, path.basename(PRODUCTS[key].url));

// Be polite to NASA's server: at most 4 requests at once, retry transient failures.
const MAX_PARALLEL = 2;
export const stats = { requests: 0, retries: 0, lastStatus: 0 };
let active = 0;
const queue = [];
const baseFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  if (active >= MAX_PARALLEL) await new Promise((r) => queue.push(r));
  active++;
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        const headers = new Headers(init?.headers); // keeps the Range header geotiff sets
        headers.set('User-Agent', 'RefaeyOnTheMoon-horizons/0.1 (NASA Space Apps 2026)');
        const res = await baseFetch(input, { ...init, headers });
        if ((res.status >= 500 || res.status === 429 || res.status === 403) && attempt < 6) {
          stats.retries++;
          stats.lastStatus = res.status;
          throw new Error(`HTTP ${res.status}`);
        }
        if (!res.ok) console.error(`  ! HTTP ${res.status} for ${headers.get('Range') ?? 'full file'}`);
        stats.requests++;
        return res;
      } catch (err) {
        if (attempt >= 6) throw err;
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  } finally {
    active--;
    queue.shift()?.();
  }
};

export const R_MOON = 1737400; // m
const DEG = Math.PI / 180;

/** South polar stereographic (EPSG variant A, k0 = 1, lon0 = 0): x = ρ sinλ, y = ρ cosλ. */
export function project(latDeg, lonDeg) {
  const rho = 2 * R_MOON * Math.tan(Math.PI / 4 + (latDeg * DEG) / 2);
  return { x: rho * Math.sin(lonDeg * DEG), y: rho * Math.cos(lonDeg * DEG) };
}

export function unproject(x, y) {
  const rho = Math.hypot(x, y);
  const lat = 2 * Math.atan(rho / (2 * R_MOON)) - Math.PI / 2;
  return { lat: lat / DEG, lon: Math.atan2(x, y) / DEG };
}

/** Destination point along a great circle: start (lat, lon), bearing α from north, angular distance γ (rad). */
export function destination(latDeg, lonDeg, bearingDeg, gamma) {
  const φ1 = latDeg * DEG;
  const λ1 = lonDeg * DEG;
  const θ = bearingDeg * DEG;
  const sinφ2 = Math.sin(φ1) * Math.cos(gamma) + Math.cos(φ1) * Math.sin(gamma) * Math.cos(θ);
  const φ2 = Math.asin(Math.max(-1, Math.min(1, sinφ2)));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(gamma) * Math.cos(φ1), Math.cos(gamma) - Math.sin(φ1) * sinφ2);
  return { lat: φ2 / DEG, lon: λ2 / DEG };
}

/** NASA PGDA products we use. `half` = half-width of the square map in metres. */
export const PRODUCTS = {
  '87S_5M': { url: 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/ldem_87s_5mpp.tif', res: 5, product: 'PGDA 81 LOLA 5 m mosaic (87–90°S)' },
  '83S_10M': { url: 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_83S_10MPP_ADJ.TIF', res: 10, product: 'PGDA 90 LDEM_83S_10MPP_ADJ' },
  '80S_20M': { url: 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF', res: 20, product: 'PGDA 90 LDEM_80S_20MPP_ADJ' },
  '75S_30M': { url: 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_75S_30MPP_ADJ.TIF', res: 30, product: 'PGDA 90 LDEM_75S_30MPP_ADJ' },
  '60S_60M': { url: 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_60MPP_ADJ.TIF', res: 60, product: 'PGDA 90 LDEM_60S_60MPP_ADJ' },
  '80S_80M': { url: 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF', res: 80, product: 'PGDA 90 LDEM_80S_80MPP_ADJ' },
  '60S_240M': { url: 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF', res: 240, product: 'PGDA 90 LDEM_60S_240MPP_ADJ' },
};

const opened = new Map();
async function open(key) {
  if (!opened.has(key)) {
    const local = localPath(key);
    const tiff = existsSync(local) ? await fromFile(local) : await fromUrl(PRODUCTS[key].url, { allowFullFile: false });
    const img = await tiff.getImage(0);
    const [ox, oy] = img.getOrigin();
    const [rx, ry] = img.getResolution();
    opened.set(key, { tiff, img, ox, oy, rx, ry, w: img.getWidth(), h: img.getHeight() });
  }
  return opened.get(key);
}

/** Does the product's grid contain the square of half-size `radius` m around (x, y)? */
export async function covers(key, x, y, radius) {
  const m = await open(key);
  const x0 = m.ox, x1 = m.ox + m.w * m.rx, y1 = m.oy, y0 = m.oy + m.h * m.ry;
  return x - radius >= x0 && x + radius <= x1 && y - radius >= y0 && y + radius <= y1;
}

/**
 * Load a window (full resolution) of `key` around (x, y) with half-size `radius` m,
 * clipped to the map. Returns a sampler with bilinear interpolation (NaN outside / no data).
 */
export async function loadWindow(key, x, y, radius) {
  const m = await open(key);
  const col0 = Math.max(0, Math.floor((x - radius - m.ox) / m.rx));
  const col1 = Math.min(m.w, Math.ceil((x + radius - m.ox) / m.rx) + 1);
  const row0 = Math.max(0, Math.floor((y + radius - m.oy) / m.ry)); // ry < 0
  const row1 = Math.min(m.h, Math.ceil((y - radius - m.oy) / m.ry) + 1);
  const [data] = await m.img.readRasters({ window: [col0, row0, col1, row1] });
  const W = col1 - col0;
  const H = row1 - row0;
  // Pixel-registered: pixel (c, r) centre at ox + (c + 0.5) rx, oy + (r + 0.5) ry.
  const sample = (px, py) => {
    const fc = (px - m.ox) / m.rx - 0.5 - col0;
    const fr = (py - m.oy) / m.ry - 0.5 - row0;
    const c = Math.floor(fc), r = Math.floor(fr);
    if (c < 0 || r < 0 || c + 1 >= W || r + 1 >= H) return NaN;
    const dx = fc - c, dy = fr - r;
    const i = r * W + c;
    return (
      data[i] * (1 - dx) * (1 - dy) + data[i + 1] * dx * (1 - dy) + data[i + W] * (1 - dx) * dy + data[i + W + 1] * dx * dy
    );
  };
  return { key, res: m.rx, sample, bytes: data.byteLength };
}
