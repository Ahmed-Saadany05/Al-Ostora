import type {
  DayReport,
  HorizonProfile,
  IsoTime,
  LaunchPlan,
  Params,
  Site,
  SiteMetrics,
  SkyState,
} from '../types';

/**
 * The ONE way screens get numbers. The demo provider and the real provider
 * (data pipeline + engine) both implement this, so screens never change when
 * we switch. Methods take a full `Site` so custom coordinates work too.
 */
export interface DataProvider {
  /** 'demo' or 'live' — the status bar shows this. */
  readonly id: 'demo' | 'live';
  readonly label: string;

  listSites(): Promise<Site[]>;
  getHorizon(site: Site, params?: Partial<Params>): Promise<HorizonProfile>;
  /**
   * Called on EVERY clock tick while playing (~10×/s), so it must be cheap.
   * Live implementation: fetch a range from Horizons once, cache it, and interpolate.
   * Never make one network request per call.
   */
  getSky(site: Site, time: IsoTime, params?: Partial<Params>): Promise<SkyState>;
  /** Samples from `start` for `days` (default one lunar day ≈ 29.53 d). */
  getDayReport(site: Site, start: IsoTime, days?: number, params?: Partial<Params>): Promise<DayReport>;
  getMetrics(site: Site, from: IsoTime, to: IsoTime, params?: Partial<Params>): Promise<SiteMetrics>;
  /** Launch date → landing date (+ the transit assumption). */
  planLaunch(site: Site, launchDate: IsoTime): Promise<LaunchPlan>;
}
