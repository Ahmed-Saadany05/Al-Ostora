/**
 * Real 3D ground for the "stand on site" view. Owner: Hagras (scripts/terrain/export.mjs).
 *
 * Each exported site has a 12 × 12 km height grid (20 m spacing) in public/terrain/<id>.i16,
 * heights relative to the site (int16 × heightStepM), from NASA LOLA (polar) or SLDEM2015 (60°S–60°N).
 * The grid is only downloaded when that site is opened (~0.7 MB).
 *
 * The returned object matches the view's TerrainSource (src/scenes/moonview/terrain.ts):
 * heightAt(x east, z south) in metres from the observer, with the Moon's curvature applied
 * (−d²/2R), so the patch sits correctly on the true-radius globe Pink lays under the site.
 */
import meta from './sites.json';

export interface TerrainMeta {
  siteId: string;
  lat: number;
  lon: number;
  n: number;
  spacingM: number;
  radiusM: number;
  siteHeightM: number;
  product: string;
  resolutionM: number;
  noDataFraction: number;
  /** Metres per int16 step (0.1 normally; 0.2 for very deep relief such as Shackleton). */
  heightStepM?: number;
}

export interface RealTerrain {
  heightAt(x: number, z: number): number;
  radius: number;
  label: string;
  placeholder: boolean;
}

const R_MOON = 1737400;
const META = meta as unknown as Record<string, TerrainMeta>;
const cache = new Map<string, Promise<RealTerrain | undefined>>();

/** Metadata if this site has an exported grid that still matches its catalogue coordinates. */
export function terrainMeta(siteId: string, lat: number, lon: number): TerrainMeta | undefined {
  const m = META[siteId];
  if (!m || Math.abs(m.lat - lat) > 1e-6 || Math.abs(m.lon - lon) > 1e-6) return undefined;
  return m;
}

function shortProduct(m: TerrainMeta) {
  return m.product.startsWith('SLDEM') ? 'SLDEM2015' : 'LOLA';
}

async function load(m: TerrainMeta): Promise<RealTerrain | undefined> {
  const res = await fetch(`${import.meta.env.BASE_URL}terrain/${m.siteId}.i16`);
  if (!res.ok) return undefined;
  const buf = await res.arrayBuffer();
  if (buf.byteLength !== m.n * m.n * 2) return undefined; // e.g. the dev server's HTML fallback
  const grid = new Int16Array(buf);
  const { n, spacingM, radiusM } = m;
  const step = m.heightStepM ?? 0.1;
  const at = (r: number, c: number) => grid[Math.min(n - 1, Math.max(0, r)) * n + Math.min(n - 1, Math.max(0, c))] * step;
  return {
    radius: radiusM,
    label: `Real terrain · NASA ${shortProduct(m)} ${m.resolutionM} m`,
    placeholder: false,
    heightAt(x: number, z: number) {
      // Grid: row 0 = north edge, column 0 = west edge. View: z points SOUTH.
      const fc = (x + radiusM) / spacingM;
      const fr = (z + radiusM) / spacingM; // north = −z → row grows southward, same as z
      const c = Math.floor(fc);
      const r = Math.floor(fr);
      const dx = fc - c;
      const dy = fr - r;
      const h = at(r, c) * (1 - dx) * (1 - dy) + at(r, c + 1) * dx * (1 - dy) + at(r + 1, c) * (1 - dx) * dy + at(r + 1, c + 1) * dx * dy;
      const d2 = x * x + z * z;
      return h - d2 / (2 * R_MOON); // the ground curves away below the tangent plane
    },
  };
}

/** Load the real terrain for a site (cached), or undefined if none was exported. */
export function loadRealTerrain(siteId: string, lat: number, lon: number): Promise<RealTerrain | undefined> {
  const m = terrainMeta(siteId, lat, lon);
  if (!m) return Promise.resolve(undefined);
  if (!cache.has(siteId)) cache.set(siteId, load(m).catch(() => undefined));
  return cache.get(siteId)!;
}
