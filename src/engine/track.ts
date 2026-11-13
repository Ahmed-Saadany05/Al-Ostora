/**
 * One body's ephemeris as a time series, interpolated between Horizons rows.
 *
 * Direction is interpolated as an ENU unit vector (not raw azimuth: avoids the 0/360 wrap
 * and the near-zenith blow-up), using cubic Hermite with central-difference tangents, then
 * re-normalised. Distance, diameter and illumination are interpolated linearly (spec §4).
 */
import { azElToVec, normalize, vecToAzEl, type Vec3 } from './geometry';
import type { EphemerisRow } from './types';

export interface BodySample {
  azDeg: number;
  elDeg: number;
  vec: Vec3;
  distanceKm: number;
  angularDiameterDeg: number;
  /** Earth only, when the proxy provides quantity 10. Percent. */
  illuminationPct?: number;
}

export class Track {
  readonly t: Float64Array;
  private readonly v: Float64Array;
  private readonly dist: Float64Array;
  private readonly diam: Float64Array;
  private readonly illum: Float64Array | null;

  constructor(rows: readonly EphemerisRow[]) {
    const sorted = [...rows]
      .map((r) => ({ r, ms: Date.parse(r.time) }))
      .filter((x) => Number.isFinite(x.ms))
      .sort((a, b) => a.ms - b.ms)
      .filter((x, i, a) => i === 0 || x.ms !== a[i - 1].ms);
    if (sorted.length === 0) throw new Error('Ephemeris track needs at least one row');
    const n = sorted.length;
    this.t = new Float64Array(n);
    this.v = new Float64Array(3 * n);
    this.dist = new Float64Array(n);
    this.diam = new Float64Array(n);
    const hasIllum = sorted.every((x) => typeof x.r.illuminationPct === 'number');
    this.illum = hasIllum ? new Float64Array(n) : null;
    sorted.forEach(({ r, ms }, i) => {
      this.t[i] = ms;
      const u = azElToVec(r.azDeg, r.elDeg);
      this.v.set(u, 3 * i);
      this.dist[i] = r.distanceKm;
      this.diam[i] = r.angularDiameterDeg;
      if (this.illum) this.illum[i] = r.illuminationPct!;
    });
  }

  get startMs() {
    return this.t[0];
  }
  get endMs() {
    return this.t[this.t.length - 1];
  }
  covers(ms: number) {
    return ms >= this.startMs && ms <= this.endMs;
  }

  /** Index i with t[i] ≤ ms < t[i+1] (clamped). */
  private seg(ms: number): number {
    let lo = 0;
    let hi = this.t.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.t[mid] <= ms) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  private vec(i: number): Vec3 {
    return [this.v[3 * i], this.v[3 * i + 1], this.v[3 * i + 2]];
  }

  /** Tangent dP/dt at row i (per ms), central difference where possible. */
  private tangent(i: number): Vec3 {
    const n = this.t.length;
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    const pa = this.vec(a);
    const pb = this.vec(b);
    const dt = this.t[b] - this.t[a];
    return [(pb[0] - pa[0]) / dt, (pb[1] - pa[1]) / dt, (pb[2] - pa[2]) / dt];
  }

  /** Interpolated sample. Caller must check `covers(ms)` first. */
  at(ms: number): BodySample {
    const n = this.t.length;
    if (n === 1) return this.row(0);
    const i = this.seg(ms);
    const j = Math.min(i + 1, n - 1);
    if (i === j || ms === this.t[i]) return this.row(i);
    const h = this.t[j] - this.t[i];
    const u = (ms - this.t[i]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    const p0 = this.vec(i);
    const p1 = this.vec(j);
    const m0 = this.tangent(i);
    const m1 = this.tangent(j);
    const vec = normalize([0, 1, 2].map(
      (k) => h00 * p0[k] + h10 * h * m0[k] + h01 * p1[k] + h11 * h * m1[k],
    ) as Vec3);
    const lin = (arr: Float64Array) => arr[i] + (arr[j] - arr[i]) * u;
    const { azDeg, elDeg } = vecToAzEl(vec);
    return {
      azDeg,
      elDeg,
      vec,
      distanceKm: lin(this.dist),
      angularDiameterDeg: lin(this.diam),
      illuminationPct: this.illum ? lin(this.illum) : undefined,
    };
  }

  private row(i: number): BodySample {
    const vec = this.vec(i);
    const { azDeg, elDeg } = vecToAzEl(vec);
    return {
      azDeg,
      elDeg,
      vec,
      distanceKm: this.dist[i],
      angularDiameterDeg: this.diam[i],
      illuminationPct: this.illum ? this.illum[i] : undefined,
    };
  }
}
