/**
 * NASA SLDEM2015 reader (LOLA + Kaguya, Barker et al. 2016, PGDA product 54) — dev-only.
 * Covers 60°S–60°N at 512 px/deg (~59 m). Tiles: 30° lat × 45° lon, raw little-endian float32,
 * km above the 1737.4 km sphere, north row first, simple cylindrical, MEAN EARTH / DE421 frame.
 * We read only the row pieces around a site with HTTP range requests (no 1.4 GB downloads).
 */
const BASE = 'http://imbrium.mit.edu/DATA/SLDEM2015/TILES/FLOAT_IMG/';
const PPD = 512;
const TILE_ROWS = 30 * PPD; // 15360
const TILE_COLS = 45 * PPD; // 23040
const BANDS = ['30N_60N', '00N_30N', '30S_00S', '60S_30S']; // north → south, 15360 rows each
const PARALLEL = 12;
const R_M = 1737400;

export const SLDEM_PRODUCT = 'SLDEM2015 (LOLA + Kaguya, PGDA 54), 512 px/deg';

export function sldemCovers(lat, marginM) {
  const dLat = (marginM / R_M) * (180 / Math.PI);
  return lat + dLat < 60 && lat - dLat > -60;
}

const tileName = (band, lonIdx) => {
  const a = String(lonIdx * 45).padStart(3, '0');
  const b = String(lonIdx * 45 + 45).padStart(3, '0');
  return `SLDEM2015_512_${band}_${a}_${b}_FLOAT.IMG`;
};

async function fetchRange(url, start, end) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}`, 'User-Agent': 'RefaeyOnTheMoon-terrain/0.1 (NASA Space Apps 2026)' } });
      if (res.status !== 206) throw new Error(`HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= 5) throw e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

/** Read global row gRow (0 = 60°N), global columns [c0, c1) (0 = 0°E), wrapping at 360°. */
async function readRow(gRow, c0, c1) {
  const band = Math.floor(gRow / TILE_ROWS);
  const tr = gRow - band * TILE_ROWS;
  const out = new Float32Array(c1 - c0);
  const total = 360 * PPD;
  let c = c0;
  while (c < c1) {
    const gc = ((c % total) + total) % total;
    const lonIdx = Math.floor(gc / TILE_COLS);
    const tc = gc - lonIdx * TILE_COLS;
    const n = Math.min(c1 - c, TILE_COLS - tc);
    const off = (tr * TILE_COLS + tc) * 4;
    const bytes = await fetchRange(BASE + tileName(BANDS[band], lonIdx), off, off + n * 4 - 1);
    out.set(new Float32Array(bytes.buffer, bytes.byteOffset, n), c - c0);
    c += n;
  }
  return out;
}

/** Window of half-size `marginM` around (lat, lon) with a bilinear sampler (lat, lon) → metres. */
export async function sldemWindow(lat, lon, marginM) {
  const dLat = (marginM / R_M) * (180 / Math.PI);
  const dLon = dLat / Math.max(0.05, Math.cos((lat * Math.PI) / 180));
  // Pixel centres: row i at lat 60 − (i + 0.5)/PPD; column j at lon (j + 0.5)/PPD.
  const r0 = Math.max(0, Math.floor((60 - (lat + dLat)) * PPD - 0.5));
  const r1 = Math.min(4 * TILE_ROWS - 1, Math.ceil((60 - (lat - dLat)) * PPD - 0.5) + 1);
  const lonE = ((lon % 360) + 360) % 360;
  const c0 = Math.floor((lonE - dLon) * PPD - 0.5);
  const c1 = Math.ceil((lonE + dLon) * PPD - 0.5) + 2;
  const W = c1 - c0;
  const H = r1 - r0 + 1;
  const data = new Float32Array(W * H);
  let next = 0;
  const worker = async () => {
    while (next < H) {
      const i = next++;
      data.set(await readRow(r0 + i, c0, c1), i * W);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  const sample = (la, lo) => {
    let le = ((lo % 360) + 360) % 360;
    // keep longitudes continuous with the window around 0/360
    if (le - lonE > 180) le -= 360;
    if (lonE - le > 180) le += 360;
    const fr = (60 - la) * PPD - 0.5 - r0;
    const fc = le * PPD - 0.5 - c0;
    const r = Math.floor(fr);
    const c = Math.floor(fc);
    if (r < 0 || c < 0 || r + 1 >= H || c + 1 >= W) return NaN;
    const dy = fr - r;
    const dx = fc - c;
    const i = r * W + c;
    const km = data[i] * (1 - dx) * (1 - dy) + data[i + 1] * dx * (1 - dy) + data[i + W] * (1 - dx) * dy + data[i + W + 1] * dx * dy;
    return km * 1000;
  };
  return { sample, resolutionM: 59, bytes: data.byteLength };
}
