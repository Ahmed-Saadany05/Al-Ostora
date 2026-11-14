/**
 * REALISM near the observer (Aser, on top of Hagras's real terrain and Pink's view).
 *
 * The real NASA grid has a height every 20 m (LOLA) or 59 m (SLDEM2015), and the view's mesh a point
 * every ~23 m, so anything smaller looks perfectly smooth. This adds the detail the data is too coarse
 * to show, ONLY in a patch around you:
 *  - small craters (bowl + low raised rim), many small and few larger: on real terrain only sizes
 *    below the data's resolution (radius up to ~9 m), so no invented crater the data would show;
 *  - fine regolith bumps (decimetres);
 *  - brightness (albedo) patches and fresher, brighter rims on some small craters.
 * Generated from seeded noise (no images or datasets, nothing to credit), the same for a site every time.
 *
 * It never changes a number: the cards, gates and scores come from the data layer, not from this mesh.
 * It also keeps the view honest: bumps stay under 1 m (below the 1.8 m eye) and the detail fades out
 * to the real ground at the patch edge, so the skyline and the big shapes are Hagras's real terrain.
 */

/** Half-width of the detailed patch (m). The coarse mesh is hidden inside NEAR_HOLE. */
export const NEAR_HALF = 260;
export const NEAR_HOLE = 245;
/** The detail is full inside FADE_IN and gone at FADE_OUT (square distance), where the patch meets the coarse mesh. */
const FADE_IN = 170;
const FADE_OUT = 235;

function valueNoise(seed: number) {
  const hash = (i: number, j: number) => {
    let h = (i * 374761393) ^ (j * 668265263) ^ (seed * 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, z: number) => {
    const i = Math.floor(x);
    const j = Math.floor(z);
    const u = smooth(x - i);
    const v = smooth(z - j);
    const a = hash(i, j);
    const b = hash(i + 1, j);
    const c = hash(i, j + 1);
    const d = hash(i + 1, j + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Seed from a site position, so each site has its own (stable) detail. */
export function detailSeed(lat = 0, lon = 0) {
  return (Math.abs(Math.round(lat * 1000) * 7919 + Math.round(lon * 1000) * 104729) % 2147483646) + 1;
}

/** 0 at the patch edge … 1 inside. */
export function detailWeight(x: number, z: number) {
  const d = Math.max(Math.abs(x), Math.abs(z));
  if (d <= FADE_IN) return 1;
  if (d >= FADE_OUT) return 0;
  const t = (d - FADE_IN) / (FADE_OUT - FADE_IN);
  return 1 - t * t * (3 - 2 * t);
}

export interface SurfaceDetail {
  /** Height to ADD to the real ground (m). */
  heightAt(x: number, z: number): number;
  /** Surface brightness multiplier (~0.65–1.35), smooth everywhere so the patch and the far ground match. */
  albedoAt(x: number, z: number, near: boolean): number;
}

export function surfaceDetail(seed: number, realGround: boolean): SurfaceDetail {
  const n = valueNoise(seed + 17);
  const hash = (i: number, j: number, k: number) => {
    let h = (i * 73856093) ^ (j * 19349663) ^ ((k + seed) * 83492791);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  // [cell size m, chance a cell has a crater, max radius as a fraction of the cell].
  // Real ground: only craters smaller than the data resolution. Placeholder: a larger size too.
  const SCALES: [number, number, number][] = realGround
    ? [
        [7, 0.55, 0.42],
        [22, 0.4, 0.4],
      ]
    : [
        [7, 0.55, 0.42],
        [22, 0.4, 0.4],
        [70, 0.3, 0.38],
      ];
  const craters = (x: number, z: number) => {
    let h = 0;
    let fresh = 0;
    SCALES.forEach(([cell, chance, maxR], k) => {
      const ci = Math.floor(x / cell);
      const cj = Math.floor(z / cell);
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          const i = ci + di;
          const j = cj + dj;
          if (hash(i, j, k) > chance) continue;
          const cx = (i + hash(i, j, k + 10)) * cell;
          const cz = (j + hash(i, j, k + 20)) * cell;
          const r = cell * (0.12 + hash(i, j, k + 30) * (maxR - 0.12));
          const d = Math.hypot(x - cx, z - cz) / r;
          if (d >= 1.5) continue;
          if (d < 1) h -= 0.3 * r * (1 - d * d); // bowl
          else h += 0.06 * r * (1 - (d - 1) / 0.5) ** 2; // rim
          if (hash(i, j, k + 40) > 0.75 && d > 0.7 && d < 1.3) fresh = Math.max(fresh, 1 - Math.abs(d - 1) / 0.3);
        }
    });
    return { h, fresh };
  };
  const micro = (x: number, z: number) => (n(x / 3, z / 3) - 0.5) * 0.22 + (n(x / 1.1 + 40, z / 1.1) - 0.5) * 0.07;
  const weight = (x: number, z: number) => {
    const pad = Math.min(1, Math.max(0, (Math.hypot(x, z) - 6) / 30)); // keep the landing spot level
    return pad * detailWeight(x, z);
  };
  return {
    heightAt(x, z) {
      const w = weight(x, z);
      if (w === 0) return 0;
      return Math.min(1, (craters(x, z).h + micro(x, z)) * w); // never above 1 m: below the eye
    },
    albedoAt(x, z, near) {
      const big = (n(x / 900 + 3, z / 900 - 8) - 0.5) * 0.24 + (n(x / 140, z / 140) - 0.5) * 0.12;
      const fresh = near ? craters(x, z).fresh * weight(x, z) * 0.22 : 0;
      return Math.min(1.35, Math.max(0.65, 1 + big + fresh));
    },
  };
}

/** Rock placements (x, z, size) inside the patch: power-law sizes, more close by, all under 1.1 m. */
export function rockField(seed: number, count = 1100, maxR = FADE_IN) {
  let s = (seed % 2147483646) * 9301 + 49297;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const out: { x: number; z: number; size: number; rot: [number, number, number]; squash: [number, number] }[] = [];
  for (let i = 0; i < count; i++) {
    const d = 6 + Math.pow(rnd(), 1.6) * (maxR - 6);
    const a = rnd() * Math.PI * 2;
    const size = Math.min(1.1, 0.06 * Math.pow(1 - rnd() * 0.999, -1 / 1.8));
    out.push({
      x: Math.sin(a) * d,
      z: -Math.cos(a) * d,
      size,
      rot: [rnd() * 0.6, rnd() * Math.PI * 2, rnd() * 0.6],
      squash: [0.6 + rnd() * 0.5, 0.8 + rnd() * 0.4],
    });
  }
  return out;
}
