/**
 * Right-hand panel of step 1 (owner: Pink), laid out like the design:
 *   MISSION DESIGN  (01)(02)(03)
 *   + FIRST, FIND YOUR PLACE
 *   A world of / possibilities.
 *   01 Nearside · 3 landing spots  ◐ ↗   … 05 Custom coordinates ⌖ ↗
 * Choosing a region lists its sites (a light dot each, like the pins on the Moon); "Custom
 * coordinates" opens a lat/lon form. The step's footer (selection + primary button) sits at the bottom.
 * Hover/focus is reported up so the 3D Moon can turn and glow.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { formatLatLon } from '@/shared/format';
import type { Site } from '@/shared/types';
import { Button, Icon } from '@/shared/ui';
import type { RegionId } from '../lib/moonFrame';
import g from './globe.module.css';

/** Display order and words for each region (plain language for the public). */
export const REGIONS: RegionId[] = ['nearside', 'farside', 'north-pole', 'south-pole'];
export const REGION_COPY: Record<RegionId, { name: string; accent: string; blurb: string }> = {
  nearside: {
    name: 'Nearside',
    accent: 'familiar ground.',
    blurb: 'Always faces Earth, so a radio link is easy. Apollo landed here.',
  },
  farside: {
    name: 'Farside',
    accent: 'discoveries.',
    blurb: 'Beyond the familiar. Heavily cratered highlands on the side facing away from Earth: no direct radio contact without a relay.',
  },
  'north-pole': {
    name: 'North polar',
    accent: 'long shadows.',
    blurb: 'A low Sun skims the horizon, like at the south pole, but far less explored.',
  },
  'south-pole': {
    name: 'South polar',
    accent: 'ice and light.',
    blurb: 'Water ice in craters that never see the Sun; ridges in near-constant light. Artemis goes here.',
  },
};

/** Half-lit disc per region: which side of the Moon it is. */
function RegionIcon({ region }: { region: RegionId }) {
  const half: Record<RegionId, string> = {
    nearside: 'M12 3 A9 9 0 0 0 12 21 Z',
    farside: 'M12 3 A9 9 0 0 1 12 21 Z',
    'north-pole': 'M3 12 A9 9 0 0 1 21 12 Z',
    'south-pole': 'M3 12 A9 9 0 0 0 21 12 Z',
  };
  return (
    <svg className={g.regionIcon} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d={half[region]} fill="currentColor" />
    </svg>
  );
}

function CrosshairIcon() {
  return (
    <svg className={g.regionIcon} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.2">
      <circle cx="12" cy="12" r="6" />
      <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
    </svg>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

interface Props {
  sites: Site[];
  selectedIds: string[];
  active: RegionId | null;
  /** The custom-coordinates view is open. */
  custom: boolean;
  onHoverRegion: (r: RegionId | null) => void;
  onChooseRegion: (r: RegionId) => void;
  onOpenCustom: () => void;
  onHoverSite: (id: string | null) => void;
  onChooseSite: (id: string) => void;
  onCoords: (lat: number, lon: number) => void;
  footer?: ReactNode;
}

/** MISSION DESIGN + the three steps of the flow: 01 site, 02 dates, 03 launch. */
function Stepper({ siteDone }: { siteDone: boolean }) {
  const steps = [
    { n: 1, label: 'Choose a site' },
    { n: 2, label: 'Pick a date' },
    { n: 3, label: 'Launch' },
  ];
  const current = siteDone ? 2 : 1;
  return (
    <div className={g.stepper}>
      <span className={g.kicker}>Mission design</span>
      <ol className={g.steps} aria-label="Mission steps">
        {steps.map((s) => (
          <li
            key={s.n}
            className={[g.step, s.n === current && g.stepNow, s.n < current && g.stepDone].filter(Boolean).join(' ')}
            aria-current={s.n === current ? 'step' : undefined}
            title={s.label}
          >
            {s.n < current ? <Icon name="check" size={11} /> : <span className="num">{pad(s.n)}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SectorMenu({
  sites,
  selectedIds,
  active,
  custom,
  onHoverRegion,
  onChooseRegion,
  onOpenCustom,
  onHoverSite,
  onChooseSite,
  onCoords,
  footer,
}: Props) {
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [error, setError] = useState<string>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const la = Number(lat);
    const lo = Number(lon);
    if (lat.trim() === '' || !Number.isFinite(la) || la < -90 || la > 90) return setError('Latitude must be between −90 and 90.');
    if (lon.trim() === '' || !Number.isFinite(lo) || lo < -180 || lo > 180) return setError('Longitude must be between −180 and 180.');
    setError(undefined);
    onCoords(la, lo);
  };

  const hover = (r: RegionId | null) => ({
    onMouseEnter: () => onHoverRegion(r),
    onMouseLeave: () => onHoverRegion(null),
    onFocus: () => onHoverRegion(r),
    onBlur: () => onHoverRegion(null),
  });
  const catalogued = sites.filter((x) => x.kind !== 'custom');
  const head = (eyebrow: string | null, title: string, accent: string, lead: ReactNode) => (
    <header className={g.panelHead}>
      {eyebrow && (
        <span className={g.eyebrowPlus}>
          <Icon name="plus" size={12} /> {eyebrow}
        </span>
      )}
      <h2 className={g.panelTitle}>
        <span>{title}</span>
        <em>{accent}</em>
      </h2>
      <p className={g.panelLead}>{lead}</p>
    </header>
  );

  const siteRow = (site: Site) => {
    const selected = selectedIds.includes(site.id);
    const name = site.kind === 'custom' ? 'Your pin' : site.name;
    return (
      <li key={site.id}>
        <button
          type="button"
          className={[g.row, selected && g.rowOn].filter(Boolean).join(' ')}
          data-site={site.id}
          onClick={() => onChooseSite(site.id)}
          onMouseEnter={() => onHoverSite(site.id)}
          onMouseLeave={() => onHoverSite(null)}
          onFocus={() => onHoverSite(site.id)}
          onBlur={() => onHoverSite(null)}
          aria-pressed={selected}
          title={site.name}
        >
          {site.kind === 'custom' ? (
            <span className={g.rowPin} aria-hidden>
              <Icon name="pin" size={13} />
            </span>
          ) : (
            <span className={g.rowDot} aria-hidden />
          )}
          <span className={g.rowText}>
            <strong>{name}</strong>
            <small className="num">{formatLatLon(site.lat, site.lon)}</small>
          </span>
          <span className={g.rowEnd} aria-hidden>
            <Icon name={selected ? 'check' : 'plus'} size={16} />
          </span>
        </button>
      </li>
    );
  };

  let body: ReactNode;
  if (custom) {
    const pins = sites.filter((x) => x.kind === 'custom');
    body = (
      <>
        {head('Your own point', 'Custom', 'coordinates.', 'Any latitude and longitude on the Moon. Type them in, or click anywhere on the surface to drop a pin.')}
        <form className={g.coordsForm} onSubmit={submit}>
          <div className={g.coordRow}>
            <input className={['num', g.input].join(' ')} placeholder="Lat −89.45" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} aria-label="Latitude" />
            <input className={['num', g.input].join(' ')} placeholder="Lon −137.3" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} aria-label="Longitude" />
            <Button type="submit" variant="secondary" leadingIcon="plus" icon={null}>
              Add
            </Button>
          </div>
          {error && (
            <span className={g.error} role="alert">
              <Icon name="alert" size={13} /> {error}
            </span>
          )}
        </form>
        {pins.length > 0 && <ul className={[g.rows, g.siteRows].join(' ')}>{pins.map(siteRow)}</ul>}
      </>
    );
  } else if (active) {
    const copy = REGION_COPY[active];
    const list = sites.filter((x) => x.region === active);
    body = (
      <>
        {head('Your landing site', copy.name, copy.accent, copy.blurb)}
        <ul className={[g.rows, g.siteRows].join(' ')} aria-label={`${copy.name} landing sites`}>
          {list.length === 0 && <li className={g.menuEmpty}>No catalogued sites here yet. Click the Moon to drop your own pin.</li>}
          {list.map(siteRow)}
        </ul>
      </>
    );
  } else {
    body = (
      <>
        {head(
          null,
          'A world of',
          'possibilities.',
          <>
            Four regions. <span className="num">{catalogued.length}</span> places to begin.
            <br />
            Where will your journey take you?
          </>,
        )}
        <ul className={g.rows} aria-label="Regions of the Moon">
          {REGIONS.map((r, i) => {
            const count = catalogued.filter((x) => x.region === r).length;
            return (
              <li key={r} {...hover(r)}>
                <button type="button" className={g.row} data-region={r} onClick={() => onChooseRegion(r)}>
                  <span className={['num', g.rowNum].join(' ')}>{pad(i + 1)}</span>
                  <span className={g.rowText}>
                    <strong className={g.rowBig}>{REGION_COPY[r].name}</strong>
                    <small>
                      <span className="num">{count}</span> landing {count === 1 ? 'spot' : 'spots'}
                    </small>
                  </span>
                  <RegionIcon region={r} />
                  <span className={g.rowEnd} aria-hidden>
                    <Icon name="arrowUpRight" size={16} />
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" className={g.row} onClick={onOpenCustom}>
              <span className={['num', g.rowNum].join(' ')}>{pad(REGIONS.length + 1)}</span>
              <span className={g.rowText}>
                <strong className={g.rowBig}>Custom coordinates</strong>
                <small>Any point on the Moon</small>
              </span>
              <CrosshairIcon />
              <span className={g.rowEnd} aria-hidden>
                <Icon name="arrowUpRight" size={16} />
              </span>
            </button>
          </li>
        </ul>
      </>
    );
  }

  return (
    <nav className={g.menu} aria-label="Choose your landing site" data-open-region={custom ? 'custom' : (active ?? '')}>
      <Stepper siteDone={selectedIds.length > 0} />
      <div className={g.menuScroll}>{body}</div>
      {footer && <div className={g.menuFooter} data-menu-footer>{footer}</div>}
    </nav>
  );
}
