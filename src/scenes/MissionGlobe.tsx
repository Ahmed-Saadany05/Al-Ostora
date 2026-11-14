/**
 * Mission summary Moon (owner: Pink): the real, spinnable Moon (summary/MissionGlobe3D) with the
 * flat picture (`fallback`, Aser's) as its stand-in.
 *
 * Loads like Home and site selection: no pop-in. The flat picture stays on screen until the real
 * Moon's imagery has arrived (plus a short hold so the sharper tiles land), then cross-fades to the
 * 3D Moon. `preloadMissionGlobe(lat, lon)` fetches the 3D code and the imagery for that site into
 * the cache early (the launch page and the landed Moon view call it), so by the time the summary
 * opens there is little or nothing left to load. Without WebGL, or if the 3D view fails, the flat
 * picture simply stays.
 */
import { Component, lazy, Suspense, useCallback, useState, type ReactNode } from 'react';
import { moonTileUrls, warmCache } from './globe/moonHandoff';
import g from './summary/missionGlobe.module.css';

const load3D = () => import('./summary/MissionGlobe3D');
const MissionGlobe3D = lazy(load3D);

/** After the imagery reports ready, wait this long before the cross-fade (the finer tiles land). */
const READY_HOLD_MS = 450;

/** Earth's map in the summary scene (MissionGlobe3D). */
const EARTH_MAP = '/earth/earth_atmos_2048.jpg';
const started = new Map<string, Promise<void>>();
/** Fetch the summary Moon's code and the imagery around the site into the cache (once per site). */
export function preloadMissionGlobe(lat: number, lon: number): Promise<void> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  let p = started.get(key);
  if (!p) {
    p = Promise.all([load3D().catch(() => undefined), warmCache([...moonTileUrls(lat, lon), EARTH_MAP])]).then(() => undefined);
    started.set(key, p);
  }
  return p;
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

class Boundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[MissionGlobe] 3D Moon failed, keeping the flat picture', error);
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface MissionGlobeProps {
  lat: number;
  lon: number;
  siteName: string;
  sunlit: boolean;
  contact: boolean;
  /** The flat picture shown until the 3D Moon is ready (and kept if it can't load). */
  fallback: ReactNode;
  className?: string;
}

export function MissionGlobe({ fallback, className, ...props }: MissionGlobeProps) {
  const [webgl] = useState(hasWebGL);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onReady = useCallback(() => window.setTimeout(() => setReady(true), READY_HOLD_MS), []);
  const show3D = webgl && !failed;
  return (
    <div className={[g.stack, className].filter(Boolean).join(' ')}>
      {show3D && (
        <div className={[g.layer3D, ready && g.layerOn].filter(Boolean).join(' ')} aria-hidden={!ready}>
          <Boundary onFail={() => setFailed(true)}>
            <Suspense fallback={null}>
              <MissionGlobe3D {...props} onReady={onReady} />
            </Suspense>
          </Boundary>
        </div>
      )}
      <div className={[g.flat, show3D && ready && g.flatOut].filter(Boolean).join(' ')} aria-hidden={show3D && ready}>
        {fallback}
      </div>
    </div>
  );
}
