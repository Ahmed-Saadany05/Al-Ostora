/**
 * Cards for the Moon view (Step 2): Sun / Earth, How far away, Nearby. Every number comes from the
 * data hooks via props (SkyState, metrics, day report) and carries a SourceBadge.
 */
import { compass, formatDeg, formatDuration, formatLatLon, formatNumber, hoursBetween } from '@/shared/format';
import type { BodyPosition, DataSource, IsoTime, Site, SiteMetrics } from '@/shared/types';
import { Button, Icon, SourceBadge } from '@/shared/ui';
import st from './stand.module.css';

const C_KM_S = 299_792.458;

/** Small side-view diagram: horizon, terrain bump and a line at the body's elevation (exaggerated ×6 so low angles read). */
function AngleSketch({ elDeg, kind }: { elDeg: number; kind: 'sun' | 'earth' }) {
  const a = (Math.max(-10, Math.min(30, elDeg * 6)) * Math.PI) / 180;
  const x = 10 + Math.cos(a) * 64;
  const y = 40 - Math.sin(a) * 64;
  return (
    <svg className={st.sketch} viewBox="0 0 84 48" aria-hidden>
      <path d="M2 40 L30 38 L44 34 L58 38 L82 40" className={st.sketchGround} />
      <path d="M10 40 A 64 64 0 0 0 74 40" className={st.sketchArc} transform="translate(0 0)" />
      <line x1={10} y1={40} x2={x} y2={y} className={kind === 'sun' ? st.sketchSun : st.sketchEarth} />
      <circle cx={x} cy={y} r={3.2} className={kind === 'sun' ? st.sketchSunDot : st.sketchEarthDot} />
    </svg>
  );
}

export function BodyCard({
  kind,
  body,
  visible,
  next,
  now,
  source,
}: {
  kind: 'sun' | 'earth';
  body: BodyPosition;
  visible: boolean;
  next: IsoTime | null;
  now: IsoTime;
  source: DataSource;
}) {
  const sun = kind === 'sun';
  const h = next ? hoursBetween(now, next) : null;
  return (
    <section className={st.card}>
      <header className={st.cardHead}>
        <span className={[st.dot, sun ? st.dotSun : st.dotEarth].join(' ')} aria-hidden />
        <strong>{sun ? 'Sun' : 'Earth'}</strong>
        <span className={st.muted}>· {sun ? 'solar power' : 'radio link'}</span>
        <span className={st.grow} />
        <SourceBadge source={source} />
      </header>
      <div className={st.cardMain}>
        <div>
          <p className={st.big}>
            <span className="num">{formatDeg(body.elDeg, 1)}</span>
          </p>
          <p className={st.muted}>
            {body.clearanceDeg >= 0 ? 'above the horizon' : `hidden ${formatDeg(-body.clearanceDeg, 1, false)} behind terrain`}
          </p>
        </div>
        <AngleSketch elDeg={body.elDeg} kind={kind} />
      </div>
      <dl className={st.facts}>
        <div>
          <dt>{sun ? (visible ? 'Next sunset' : 'Next sunrise') : visible ? 'Next Earth-set' : 'Next Earth-rise'}</dt>
          <dd className="num">{h === null ? 'not this lunar day' : h <= 0 ? 'now' : `in ${formatDuration(h)}`}</dd>
        </div>
        <div>
          <dt>Look toward</dt>
          <dd className="num">
            {compass(body.azDeg)} · {Math.round(body.azDeg)}°
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function HowFarCard({ earthKm, sunKm, source }: { earthKm: number; sunKm: number; source: DataSource }) {
  const earthS = earthKm / C_KM_S;
  const sunMin = sunKm / C_KM_S / 60;
  return (
    <section className={st.card}>
      <header className={st.cardHead}>
        <span className={st.eyebrow}>How far away</span>
        <span className={st.grow} />
        <SourceBadge source={source} />
      </header>
      <div className={st.track} aria-hidden>
        <span className={st.trackMoon} />
        <span className={st.trackEarth} />
        <span className={st.trackGap}>
          // <span className="num">×{Math.round(sunKm / earthKm)}</span> //
        </span>
        <span className={st.trackSun} />
      </div>
      <dl className={st.facts}>
        <div>
          <dt>
            <Icon name="earth" size={12} /> Earth
          </dt>
          <dd className="num">{formatNumber(earthKm, 0)} km</dd>
          <dd className={['num', st.small].join(' ')}>signal {formatNumber(earthS, 1)} s</dd>
        </div>
        <div className={st.factRight}>
          <dt>
            <Icon name="sun" size={12} /> Sun
          </dt>
          <dd className="num">{formatNumber(sunKm / 1e6, 1)} M km</dd>
          <dd className={['num', st.small].join(' ')}>light {formatNumber(sunMin, 1)} min</dd>
        </div>
      </dl>
    </section>
  );
}

/** Suggested nearby site. `reason` is built from that site's metrics (the engine's suggestion later). */
export function NearbyCard({
  site,
  metrics,
  distanceKm,
  onCompare,
}: {
  site: Site;
  metrics?: SiteMetrics;
  distanceKm: number;
  onCompare: () => void;
}) {
  return (
    <section className={st.card}>
      <header className={st.cardHead}>
        <span className={st.eyebrow}>Nearby · worth a look</span>
        <span className={st.grow} />
        {metrics && <SourceBadge source={metrics.source} />}
      </header>
      <h3 className={st.nearName}>{site.name}</h3>
      <p className={st.muted}>
        <span className="num">{formatLatLon(site.lat, site.lon)}</span> · <span className="num">{formatNumber(distanceKm, 0)} km</span> away
      </p>
      {metrics && (
        <p className={st.reason}>
          Earth in view <span className="num">{Math.round(metrics.earthVisibleFraction * 100)}%</span> of the lunar day, sunlit{' '}
          <span className="num">{Math.round(metrics.sunlitFraction * 100)}%</span>; longest night{' '}
          <span className="num">{formatDuration(metrics.longestNightH)}</span>.
        </p>
      )}
      <Button variant="secondary" icon="arrowUpRight" onClick={onCompare}>
        Compare side by side
      </Button>
    </section>
  );
}
