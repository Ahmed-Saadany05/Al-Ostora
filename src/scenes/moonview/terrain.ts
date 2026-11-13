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
  /** Optional surface brightness factor (≈ 0.8–1.3) at (x, z): fresh crater rims and ejecta are brighter. */
  albedoAt?(x: number, z: number): number;
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

// ---------------------------------------------------------------- site terrain (skyline from LOLA)

/** The part of a HorizonProfile this needs (skyline elevation every azStepDeg, from azimuth 0). */
export interface SkylineLike {
  azStepDeg: number;
  elevationsDeg: number[];
  observerHeightM?: number;
}

/** Skyline elevation (degrees) at an azimuth, linearly interpolated, wrapping at 360°. */
export function skylineAt(h: SkylineLike, azDeg: number): number {
  const n = h.elevationsDeg.length;
  if (n === 0) return 0;
  const f = ((((azDeg % 360) + 360) % 360) / h.azStepDeg) % n;
  const i = Math.floor(f);
  const k = f - i;
  return h.elevationsDeg[i] * (1 - k) + h.elevationsDeg[(i + 1) % n] * k;
}

/** Azimuth (degrees, clockwise from north) of ground point (x east, z south). */
export function azimuthOf(x: number, z: number): number {
  return ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360;
}

interface Crater {
  x: number;
  z: number;
  r: number;
  depth: number;
  rim: number;
  fresh: number;
}

/**
 * Terrain around a site that looks like the real thing:
 *  - SKYLINE FROM DATA: with a real LOLA horizon profile, the ground rises or falls toward the edge so
 *    that, seen from the observer, the skyline in every direction sits at the measured elevation
 *    (on a peak like Malapert the land drops away; in a crater it rises to the rim).
 *  - ILLUSTRATIVE DETAIL: a seeded crater field (bowls, raised rims, ejecta; many small, few large,
 *    fresh ones brighter) over gently rolling regolith. Not measured: labelled as such.
 * Without a horizon profile, the same detail sits under a gentle made-up skyline ("Placeholder terrain").
 */
export function siteTerrain(seed: number, horizon?: SkylineLike | null, opts: { radius?: number; craters?: boolean } = {}): TerrainSource {
  const radius = opts.radius ?? 2400;
  // No real horizon: same craters and relief, over a gentle made-up skyline (labelled as placeholder).
  const measured = Boolean(horizon && horizon.elevationsDeg.length > 0);
  if (!horizon || horizon.elevationsDeg.length === 0) {
    const sn = makeNoise(seed + 5);
    horizon = {
      azStepDeg: 1,
      elevationsDeg: Array.from({ length: 360 }, (_, i) => {
        const a = (i * Math.PI) / 180;
        return 0.3 + (sn(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + 10) - 0.5) * 2.2 + (sn(Math.cos(a) * 9, Math.sin(a) * 9) - 0.5) * 0.6;
      }),
      observerHeightM: 2,
    };
  }
  const skyline: SkylineLike = horizon;
  const n = makeNoise(seed + 17);
  const fbm = (x: number, z: number, oct = 4) => {
    let sum = 0;
    let amp = 1;
    let f = 1;
    for (let o = 0; o < oct; o++) {
      sum += amp * (n(x * f, z * f) - 0.5);
      amp *= 0.5;
      f *= 2.03;
    }
    return sum;
  };

  // Seeded crater field: power-law sizes (lots of small ones, a few large), none right underfoot.
  let st = (seed * 9301 + 49297) % 233280 || 1;
  const rnd = () => (st = (st * 9301 + 49297) % 233280) / 233280;
  const craters: Crater[] = [];
  if (opts.craters !== false) {
    for (let i = 0; i < 900; i++) {
      const r = Math.min(260, 2.5 * (1 - rnd()) ** (-1 / 1.6));
      const a = rnd() * Math.PI * 2;
      const d = rnd() ** 1.35 * radius * 0.95; // denser near the lander, where detail is seen
      if (d < r + 12) continue; // keep the lander's spot clear
      const fresh = 0.25 + 0.75 * rnd() ** 2;
      craters.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r, depth: 0.2 * 2 * r * (0.35 + 0.65 * fresh), rim: 0.035 * 2 * r * fresh, fresh });
    }
  }
  if (opts.craters !== false) {
    // A few mid-size craters in plain view (60–900 m out), whichever way you look.
    for (let i = 0; i < 14; i++) {
      const r = 14 + rnd() * 55;
      const a = (i / 14) * Math.PI * 2 + rnd() * 0.4;
      const d = 60 + r + rnd() * 820;
      const fresh = 0.5 + 0.5 * rnd();
      craters.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r, depth: 0.4 * r * (0.5 + 0.5 * fresh), rim: 0.08 * r * fresh, fresh });
    }
  }
  const craterAt = (x: number, z: number) => {
    let h = 0;
    let bright = 0;
    for (const c of craters) {
      const dx = x - c.x;
      if (dx > 3 * c.r || dx < -3 * c.r) continue;
      const dz = z - c.z;
      if (dz > 3 * c.r || dz < -3 * c.r) continue;
      const q = Math.hypot(dx, dz) / c.r;
      if (q < 1) {
        h += c.rim - c.depth * (1 - q * q);
        bright += c.fresh * 0.35 * Math.max(0, q - 0.75) * 4; // bright inner rim wall
      } else if (q < 3) {
        h += c.rim * q ** -3;
        bright += c.fresh * 0.25 * (3 - q) / 2; // ejecta blanket
      }
    }
    return { h, bright };
  };

  const eye = skyline.observerHeightM ?? 2;
  const edge = radius * 0.9;
  return {
    radius,
    label: measured ? 'Illustrative terrain · skyline from LOLA' : 'Placeholder terrain',
    placeholder: true,
    heightAt(x, z) {
      const d = Math.hypot(x, z);
      // Cone that puts the skyline at the measured elevation: height at the edge = eye + edge·tan(el).
      const el = (skylineAt(skyline, azimuthOf(x, z)) * Math.PI) / 180;
      const rimH = eye + edge * Math.tan(el);
      const t = Math.min(1, Math.max(0, (d - 40) / 360));
      const sky = rimH * (d / edge) * t * t * (3 - 2 * t); // grows linearly with distance, eased in near the lander
      const nearFlat = Math.min(1, d / 25); // level ground under the lander
      // Faded out toward the edge so the skyline stays exactly where LOLA measured it.
      const e = Math.min(1, Math.max(0, (d - edge * 0.6) / (edge * 0.35)));
      const keepSkyline = 1 - e * e * (3 - 2 * e);
      // Regolith: fine roughness the low Sun picks out, swells, rolling hills and broad undulation.
      const fine = fbm(x / 6, z / 6, 3) * 0.5 + fbm(x / 40, z / 40) * 3;
      // Big relief eases in over the first ~120 m, so the lander still stands on level ground.
      const broadIn = Math.min(1, d / 120) ** 2;
      const broad = (fbm(x / 160 + 5, z / 160 - 3, 4) * 16 + fbm(x / 600 - 11, z / 600 + 7, 3) * 34) * broadIn;
      return sky + ((fine + broad) * keepSkyline + craterAt(x, z).h) * nearFlat;
    },
    albedoAt(x, z) {
      return Math.min(1.35, 0.9 + fbm(x / 90 - 9, z / 90 + 4, 3) * 0.18 + craterAt(x, z).bright);
    },
  };
}
