/**
 * Right-hand menu of step 1 (owner: Pink). First the four sectors of the Moon; after choosing one,
 * that sector's landing sites, custom coordinates, and the step's footer (chips + primary button).
 * Hover/focus is reported up so the 3D Moon can turn and glow.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { formatLatLon } from '@/shared/format';
import type { Site } from '@/shared/types';
import { Button, Card, Icon } from '@/shared/ui';
import { REGION_LABEL, REGION_ORDER, type RegionId } from '../lib/moonFrame';
import g from './globe.module.css';

/** One line per sector: why you would (or would not) land there. Plain words for the public. */
const REGION_BLURB: Record<RegionId, string> = {
  'south-pole': 'Water ice in craters that never see the Sun; ridges in near-constant light. Artemis goes here.',
  nearside: 'Always faces Earth, so a radio link is easy. Apollo landed here.',
  farside: 'Never sees Earth: no direct radio contact without a relay satellite.',
  'north-pole': 'Long shadows and a low Sun, like the south pole, but less explored.',
};

interface Props {
  sites: Site[];
  selectedIds: string[];
  active: RegionId | null;
  onHoverRegion: (r: RegionId | null) => void;
  onChooseRegion: (r: RegionId) => void;
  onBack: () => void;
  onHoverSite: (id: string | null) => void;
  onChooseSite: (id: string) => void;
  onCoords: (lat: number, lon: number) => void;
  footer?: ReactNode;
}

export function SectorMenu({ sites, selectedIds, active, onHoverRegion, onChooseRegion, onBack, onHoverSite, onChooseSite, onCoords, footer }: Props) {
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

  if (!active) {
    return (
      <nav className={g.menu} aria-label="Sectors of the Moon">
        <p className={g.menuLabel}>Choose a sector</p>
        <div className={g.menuList}>
          {REGION_ORDER.map((r) => {
            const count = sites.filter((x) => x.region === r).length;
            return (
              <div key={r} {...hover(r)}>
                <Card padding="sm" onSelect={() => onChooseRegion(r)}>
                  <span className={g.sectorRow}>
                    <span className={g.sectorText}>
                      <strong>{REGION_LABEL[r]}</strong>
                      <span>{REGION_BLURB[r]}</span>
                    </span>
                    <span className={g.count}>
                      <span className="num">{count}</span> {count === 1 ? 'site' : 'sites'}
                      <Icon name="arrowRight" size={14} />
                    </span>
                  </span>
                </Card>
              </div>
            );
          })}
        </div>
        {footer && <div className={g.menuFooter}>{footer}</div>}
      </nav>
    );
  }

  const list = sites.filter((x) => x.region === active);
  return (
    <nav className={g.menu} aria-label={`${REGION_LABEL[active]} landing sites`}>
      <div className={g.menuHead}>
        <Button variant="ghost" leadingIcon="arrowLeft" icon={null} onClick={onBack}>
          All sectors
        </Button>
        <h2 className={g.menuTitle}>{REGION_LABEL[active]}</h2>
      </div>
      <div className={g.menuList}>
        {list.length === 0 && <p className={g.menuEmpty}>No catalogued sites here yet. Drop your own pin below.</p>}
        {list.map((site) => {
          const selected = selectedIds.includes(site.id);
          return (
            <div key={site.id} onMouseEnter={() => onHoverSite(site.id)} onMouseLeave={() => onHoverSite(null)} onFocus={() => onHoverSite(site.id)} onBlur={() => onHoverSite(null)}>
              <Card padding="sm" onSelect={() => onChooseSite(site.id)} selected={selected}>
                <span className={g.siteRow}>
                  <span className={g.check} aria-hidden>
                    {selected && <Icon name="check" size={14} />}
                  </span>
                  <span className={g.sectorText}>
                    <strong>{site.kind === 'custom' ? 'Your pin' : site.name}</strong>
                    <span className="num">{formatLatLon(site.lat, site.lon)}</span>
                  </span>
                </span>
              </Card>
            </div>
          );
        })}
      </div>

      <form className={g.coordsForm} onSubmit={submit}>
        <span className={g.menuLabel}>Or enter coordinates</span>
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
        <span className={g.menuHint}>…or click anywhere on the Moon to drop a pin.</span>
      </form>

      {footer && <div className={g.menuFooter}>{footer}</div>}
    </nav>
  );
}
