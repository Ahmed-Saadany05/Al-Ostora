/**
 * TERRAIN for the "stand on site" view (owner: Pink).
 *
 * The view asks a TerrainSource for ground heights around the observer (metres; x = east,
 * z = south, observer at the origin). Today it is a PLACEHOLDER: smooth rolling regolith plus far
 * ridges, so the low Sun throws long shadows. To use real data, write another TerrainSource:
 *  - from a LOLA height map around the site (Hagras's pipeline), or
 *  - from a HorizonProfile (skyline elevation per azimuth) by raising a ridge ring to match it.
 * Nothing else in the view changes.
 */

export interface TerrainSource {
  /** Ground height in metres at (x east, z south) metres from the observer. */
  heightAt(x: number, z: number): number;
  /** Half-width of the area to build, metres. */
  radius: number;
  /** Shown next to the view, e.g. "Placeholder terrain" or "LOLA 20 m/px". */
  label: string;
  /** True for made-up terrain (the UI labels it DEMO). */
  placeholder: boolean;
  /** Optional surface brightness (albedo, ~0.3–0.7) at a point, for regolith colour variation. */
  albedoAt?(x: number, z: number): number;
  /** Optional: rocks are only scattered closer than this (so they can never change a real skyline). */
  rockRadius?: number;
}

/** Small seeded value noise, so the placeholder looks the same every time. */
function makeNoise(seed: number) {
  const hash = (x: number, z: number) => {
    let h = (x * 374761393 + z * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, z: number) => {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const fx = smooth(x - x0);
    const fz = smooth(z - z0);
    const a = hash(x0, z0);
    const b = hash(x0 + 1, z0);
    const c = hash(x0, z0 + 1);
    const d = hash(x0 + 1, z0 + 1);
    return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
  };
}

/**
 * Placeholder: gentle rolling ground near the observer (a few metres), rising into ridges toward
 * the edge (tens of metres) so the skyline sits a degree or two above the flat horizon, as at the
 * lunar south pole. `seed` varies it per site so two sites side by side do not look identical.
 */
export function placeholderTerrain(seed = 1, radius = 2400): TerrainSource {
  const n = makeNoise(seed);
  const fbm = (x: number, z: number) => {
    let sum = 0;
    let amp = 1;
    let f = 1;
    for (let o = 0; o < 5; o++) {
      sum += amp * (n(x * f, z * f) - 0.5);
      amp *= 0.5;
      f *= 2.1;
    }
    return sum;
  };
  return {
    radius,
    label: 'Placeholder terrain',
    placeholder: true,
    heightAt(x, z) {
      const d = Math.hypot(x, z);
      const flat = Math.min(1, d / 60); // keep the ground under the observer level
      const small = fbm(x / 60, z / 60) * 3; // small bumps and craterlets
      const hills = fbm(x / 260 + 3, z / 260 - 5) * 16; // low hills: long shadows at a low Sun
      const ridge = Math.max(0, fbm(x / 520 + 11, z / 520 - 7) + 0.25) * 110; // far ridges
      const rise = Math.min(1, Math.max(0, (d - 300) / 1600)) ** 1.6; // ridges grow with distance
      // Landing sites are chosen on high ground (rims, ridges): stand on a gentle rise.
      const mound = 26 * Math.exp(-((d / 520) ** 2));
      return mound + (small + hills) * flat + ridge * rise;
    },
  };
}

/**
 * Real skyline (Aser, agreed with Pink): a ring of ridges built from a HorizonProfile (LOLA), so
 * that from the observer the skyline in EVERY direction sits at exactly the published angle.
 *
 * For an azimuth, the skyline angle θ (interpolated between the profile's samples) becomes a ridge
 * of height h = D · tan θ + eye height at distance D from the observer. The ground rises in a STRAIGHT line from
 * flat (near the lander) to that ridge: with a straight ramp, every point on the slope looks lower
 * than the ridge top, so the visible skyline is exactly θ (a curved ramp would overshoot it).
 * Negative angles (skyline below the flat horizon, e.g. curvature) slope the ground down instead.
 * Beyond D the ground stays at ridge height, so nothing further out pokes above the skyline.
 * Only the skyline is real; the shape of nearby ground is not (we have angles, not a height map).
 */
export function horizonTerrain(horizon: { azStepDeg: number; elevationsDeg: number[] }, radius = 2400, eyeM = 1.8): TerrainSource {
  const els = horizon.elevationsDeg;
  const n = els.length;
  const step = horizon.azStepDeg;
  const D = radius * 0.85; // ridge distance
  const flatR = D * 0.15; // flat ground around the lander
  const skylineAt = (azDeg: number) => {
    const f = (((azDeg % 360) + 360) % 360) / step;
    const i = Math.floor(f) % n;
    const t = f - Math.floor(f);
    return els[i] * (1 - t) + els[(i + 1) % n] * t;
  };
  return {
    radius,
    label: 'LOLA skyline',
    placeholder: false,
    rockRadius: flatR,
    heightAt(x, z) {
      const d = Math.hypot(x, z);
      if (d <= flatR) return 0;
      // x = east, z = south → azimuth from north, clockwise.
      const az = (Math.atan2(x, -z) * 180) / Math.PI;
      // + eyeM: the camera looks from eye height (MoonView3D EYE_HEIGHT), so the ridge is raised by it
      // to keep the angle seen from the eye equal to the published one.
      const h = D * Math.tan((skylineAt(az) * Math.PI) / 180) + eyeM;
      return h * Math.min(1, (d - flatR) / (D - flatR));
    },
  };
}

/**
 * REALISM (Aser, agreed with Pink): procedural lunar surface detail on top of any TerrainSource.
 * No images or datasets — generated from seeded noise, so nothing to credit.
 *  - Craters at four sizes (many small, few large): bowl ~0.35 r deep with a low raised rim.
 *  - Fine regolith bumps (decimetres).
 *  - Albedo: gentle large-scale variation, fresher (brighter) rims on some small craters.
 * `carveBeyond` (metres): beyond this distance the detail may only LOWER the ground. Used with the
 * real LOLA skyline: the ramp up to each ridge sits exactly on the skyline line, so anything added
 * on top would poke above the published skyline; carving below it keeps the skyline exact.
 * Inside it, bumps are kept under ~1 m (below the eye at 1.8 m), so they can't hide the Sun/Earth.
 */
export function withRealism(base: TerrainSource, seed = 1, carveBeyond = Infinity): TerrainSource {
  const n = makeNoise(seed + 17);
  const hash = (i: number, j: number, k: number) => {
    let h = (i * 73856093) ^ (j * 19349663) ^ ((k + seed) * 83492791);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  // [cell size m, chance a cell has a crater, max radius as a fraction of the cell]
  const SCALES: [number, number, number][] = [
    [7, 0.55, 0.42],
    [22, 0.4, 0.4],
    [70, 0.3, 0.38],
    [220, 0.22, 0.36],
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
          if (d < 1) h -= 0.35 * r * (1 - d * d); // bowl
          else h += 0.07 * r * (1 - (d - 1) / 0.5) ** 2; // rim
          if (k <= 1 && hash(i, j, k + 40) > 0.75 && d > 0.7 && d < 1.3) fresh = Math.max(fresh, 1 - Math.abs(d - 1) / 0.3);
        }
    });
    return { h, fresh };
  };
  const micro = (x: number, z: number) => (n(x / 3, z / 3) - 0.5) * 0.25 + (n(x / 1.1 + 40, z / 1.1) - 0.5) * 0.08;
  const detailAt = (x: number, z: number) => {
    const d = Math.hypot(x, z);
    const pad = Math.min(1, Math.max(0, (d - 6) / 30)); // keep the landing spot level
    const cr = craters(x, z);
    let h = (cr.h + micro(x, z)) * pad;
    if (d > carveBeyond) h = Math.min(0, h);
    else h = Math.min(h, 1); // stays below the eye
    return { h, fresh: cr.fresh * pad };
  };
  return {
    ...base,
    heightAt: (x, z) => base.heightAt(x, z) + detailAt(x, z).h,
    albedoAt: (x, z) => {
      const big = (n(x / 900 + 3, z / 900 - 8) - 0.5) * 0.12 + (n(x / 140, z / 140) - 0.5) * 0.06;
      return Math.min(0.75, Math.max(0.3, 0.5 + big + detailAt(x, z).fresh * 0.12));
    },
    rockRadius: Math.min(base.rockRadius ?? 600, Number.isFinite(carveBeyond) ? carveBeyond : 600),
  };
}

/** Simple string → number seed (site ids). */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}
