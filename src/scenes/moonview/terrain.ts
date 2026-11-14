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

/** Simple string → number seed (site ids). */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}
