/**
 * STEP 1 — Site picker (owner: Pink). Props are fixed in contracts.ts (SitePickerGlobeProps).
 *
 * layout="full": the whole step. The 3D Moon on the left (globe/PickerGlobe3D, loaded lazily) and
 * a menu on the right: first the four sectors (hover → the Moon turns and the sector glows), then
 * the chosen sector's sites (hover → its pin lights up; select → the camera zooms in close), custom
 * coordinates, and click-to-pin on the Moon. Without `layout` it renders just the globe.
 * Without WebGL, or if the 3D view fails, the flat map (SitePickerMap) takes the Moon's place.
 */
import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, Pill } from '@/shared/ui';
import type { SitePickerGlobeProps } from './contracts';
import { SitePickerMap } from './SitePickerMap';
import { REGION_COPY, SectorMenu } from './globe/SectorMenu';
import { FIT_DISTANCE, SECTOR_DISTANCE, SITE_DISTANCE, type CameraGoal } from './globe/pickerTypes';
import { preloadPickerGlobe, releaseMoonHandoff, takeMoonHandoff } from './globe/moonHandoff';
import { REGION_VIEW, regionAt, type LatLon, type RegionId } from './lib/moonFrame';
import g from './globe/globe.module.css';

const PickerGlobe3D = lazy(preloadPickerGlobe);
/** After the Home flight: keep its last frame on top until the live tiles have sharpened, then fade. */
const SNAPSHOT_HOLD_MS = 900;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** If anything in the 3D view throws, show the flat map instead of a broken step. */
class GlobeBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[SitePickerGlobe] 3D globe failed, showing the flat map', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Loading() {
  return (
    <div className={g.stage} aria-busy="true">
      <span className={g.loading}>
        <Pill icon="clock" label="Loading the 3D Moon…" />
      </span>
    </div>
  );
}

export function SitePickerGlobe(props: SitePickerGlobeProps) {
  const { sites, selectedIds, onSelectSite, onPickCoords, layout, title, footer } = props;
  const [webgl] = useState(hasWebGL);
  // Just flew here from Home? Its last frame (put on the page by moonHandoff) covers the globe until
  // our own imagery has loaded and sharpened, then fades.
  const [fromHome] = useState(() => takeMoonHandoff() !== null);
  const onImageryReady = useCallback(() => releaseMoonHandoff(SNAPSHOT_HOLD_MS), []);

  const [active, setActive] = useState<RegionId | null>(null);
  const [custom, setCustom] = useState(false);
  const [menuHover, setMenuHover] = useState<RegionId | null>(null);
  const [moonHover, setMoonHover] = useState<RegionId | null>(null);
  const [hotSiteId, setHotSiteId] = useState<string | null>(null);
  const [goal, setGoal] = useState<CameraGoal | null>(null);
  const [ripple, setRipple] = useState<(LatLon & { key: number }) | null>(null);
  const go = useCallback((p: LatLon, distance: number | null) => setGoal({ lat: p.lat, lon: p.lon, distance, key: performance.now() }), []);

  // Arriving with sites already chosen (a link, or Back from step 2): open that sector, near the site.
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current || sites.length === 0) return;
    arrived.current = true;
    const last = sites.find((x) => x.id === selectedIds[selectedIds.length - 1]);
    if (last) {
      setActive(last.region);
      go(last, 1.6);
    }
  }, [sites, selectedIds, go]);

  const hoverSector = (r: RegionId | null) => {
    setMenuHover(r);
    if (r && !active) go(REGION_VIEW[r], null); // turn to it, keep the distance
  };
  const chooseSector = (r: RegionId) => {
    setCustom(false);
    setActive(r);
    setMenuHover(null);
    go(REGION_VIEW[r], SECTOR_DISTANCE);
  };
  const back = () => {
    const from = active;
    setCustom(false);
    setActive(null);
    setHotSiteId(null);
    if (from) go(REGION_VIEW[from], FIT_DISTANCE);
  };
  const chooseSite = (id: string) => {
    const site = sites.find((x) => x.id === id);
    const willSelect = !selectedIds.includes(id);
    onSelectSite(id);
    if (site && willSelect) {
      setActive(site.region);
      go(site, SITE_DISTANCE);
    }
  };
  const pin = (p: LatLon) => {
    setRipple({ ...p, key: performance.now() });
    if (!custom) setActive(regionAt(p.lat, p.lon));
    onPickCoords?.(p.lat, p.lon);
    go(p, SITE_DISTANCE);
  };
  // On the region list a click on the Moon opens that region; inside a region (or custom) it drops a pin.
  const moonClick = (p: LatLon) => (active || custom ? pin(p) : chooseSector(regionAt(p.lat, p.lon)));
  const openCustom = () => {
    setActive(null);
    setMenuHover(null);
    setCustom(true);
  };

  const map = <SitePickerMap {...props} />;
  const globe = !webgl ? (
    map
  ) : (
    <GlobeBoundary fallback={map}>
      <Suspense fallback={<Loading />}>
        <PickerGlobe3D
          {...props}
          fromHome={fromHome}
          onImageryReady={onImageryReady}
          onSelectSite={chooseSite}
          hoverRegion={active || custom ? null : (menuHover ?? moonHover)}
          activeRegion={active}
          hotSiteId={hotSiteId}
          goal={goal}
          ripple={ripple}
          onMoonHoverRegion={setMoonHover}
          onMoonClick={moonClick}
        />
      </Suspense>
    </GlobeBoundary>
  );

  if (layout !== 'full') return globe;

  const inside = Boolean(active || custom);
  return (
    <div className={[g.layout, fromHome && g.enter].filter(Boolean).join(' ')}>
      <div className={g.left}>
        {/* Top-left: back to Home, or back to all regions. */}
        <div className={g.backLink}>
          {inside ? (
            <button type="button" className={g.backBtn} onClick={back}>
              <Icon name="arrowLeft" size={14} /> All regions
            </button>
          ) : (
            <Link to="/" className={g.backBtn}>
              <Icon name="arrowLeft" size={14} /> Back
            </Link>
          )}
        </div>
        {title && (
          <div className={[g.title, inside && g.titleHidden].filter(Boolean).join(' ')} aria-hidden={inside}>
            {title}
          </div>
        )}
        {globe}
        {/* Bottom-left caption, as in the design. */}
        <div className={g.caption}>
          <span className={g.captionTitle}>{active ? REGION_COPY[active].name : custom ? 'Custom coordinates' : 'Lunar surface'}</span>
          <span className={g.captionSub}>{inside ? 'Exploring the surface' : 'NASA LRO imagery · 384,400 km from home'}</span>
          <span className={g.captionHint}>
            <Icon name="orbit" size={14} />
            {inside ? 'Drag to rotate · Click the surface to pin a position' : 'Drag to explore · Click a region to open it'}
          </span>
        </div>
      </div>
      <SectorMenu
        sites={sites}
        selectedIds={selectedIds}
        active={active}
        custom={custom}
        onHoverRegion={hoverSector}
        onChooseRegion={chooseSector}
        onOpenCustom={openCustom}
        onHoverSite={setHotSiteId}
        onChooseSite={chooseSite}
        onCoords={(lat, lon) => pin({ lat, lon })}
        footer={footer}
      />
    </div>
  );
}
