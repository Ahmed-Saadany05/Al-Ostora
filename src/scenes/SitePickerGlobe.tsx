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
import { Pill } from '@/shared/ui';
import type { SitePickerGlobeProps } from './contracts';
import { SitePickerMap } from './SitePickerMap';
import { SectorMenu } from './globe/SectorMenu';
import { SECTOR_DISTANCE, SITE_DISTANCE, START_DISTANCE, type CameraGoal } from './globe/pickerTypes';
import { preloadPickerGlobe, takeMoonHandoff } from './globe/moonHandoff';
import { REGION_VIEW, regionAt, type LatLon, type RegionId } from './lib/moonFrame';
import g from './globe/globe.module.css';

const PickerGlobe3D = lazy(preloadPickerGlobe);
/** After the Home flight: keep its last frame on top a moment longer, then fade into the live globe. */
const SNAPSHOT_HOLD_MS = 250;

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
  // Just flew here from Home? Its last frame covers the globe until our own imagery has loaded.
  const [handoff] = useState(takeMoonHandoff);
  const fromHome = handoff !== null;
  const [snapshotGone, setSnapshotGone] = useState(false);
  const onImageryReady = useCallback(() => {
    window.setTimeout(() => setSnapshotGone(true), SNAPSHOT_HOLD_MS);
  }, []);
  useEffect(() => {
    if (!handoff) return;
    // Never leave the snapshot up for good if imagery is slow.
    const t = window.setTimeout(() => setSnapshotGone(true), 6000);
    return () => window.clearTimeout(t);
  }, [handoff]);

  const [active, setActive] = useState<RegionId | null>(null);
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
    setActive(r);
    setMenuHover(null);
    go(REGION_VIEW[r], SECTOR_DISTANCE);
  };
  const back = () => {
    const from = active;
    setActive(null);
    setHotSiteId(null);
    if (from) go(REGION_VIEW[from], START_DISTANCE);
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
    setActive(regionAt(p.lat, p.lon));
    onPickCoords?.(p.lat, p.lon);
    go(p, SITE_DISTANCE);
  };
  // On the sector list a click on the Moon picks that sector; inside a sector it drops a pin.
  const moonClick = (p: LatLon) => (active ? pin(p) : chooseSector(regionAt(p.lat, p.lon)));

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
          hoverRegion={menuHover ?? moonHover}
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

  const snapshot = handoff?.snapshot ? (
    <img
      src={handoff.snapshot}
      alt=""
      aria-hidden
      className={[g.snapshot, snapshotGone && g.snapshotGone].filter(Boolean).join(' ')}
      style={{ left: handoff.rect.left, top: handoff.rect.top, width: handoff.rect.width, height: handoff.rect.height }}
    />
  ) : null;

  if (layout !== 'full') return (
    <>
      {globe}
      {snapshot}
    </>
  );

  return (
    <div className={[g.layout, fromHome && g.enter].filter(Boolean).join(' ')}>
      <div className={g.left}>
        {title && (
          <div className={[g.title, active && g.titleHidden].filter(Boolean).join(' ')} aria-hidden={Boolean(active)}>
            {title}
          </div>
        )}
        {globe}
      </div>
      <SectorMenu
        sites={sites}
        selectedIds={selectedIds}
        active={active}
        onHoverRegion={hoverSector}
        onChooseRegion={chooseSector}
        onBack={back}
        onHoverSite={setHotSiteId}
        onChooseSite={chooseSite}
        onCoords={(lat, lon) => pin({ lat, lon })}
        footer={footer}
      />
      {snapshot}
    </div>
  );
}
