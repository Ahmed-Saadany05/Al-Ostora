/**
 * A small real Moon (owner: Pink) to sit behind a flat Moon drawing — e.g. the Moon at the end of
 * the launch-date page's flight drawing. It renders nothing until its imagery has loaded, then calls
 * `onShow` (a short hold later), so the page can fade its flat picture out in the same moment: no
 * grey sphere, no tiles popping in. `preloadMoonDisc()` fetches the code and the near-side imagery
 * early (the Moon view calls it, since the launch-date step comes next). Without WebGL, or if the 3D
 * view fails, it never calls `onShow`, and the flat picture simply stays.
 */
import { Component, lazy, Suspense, useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import { moonTileUrls, warmCache } from './globe/moonHandoff';

const load3D = () => import('./smallMoon/MoonDisc3D');
const MoonDisc3D = lazy(load3D);
/** After the imagery reports ready, wait this long before showing (the finer tiles land). */
const READY_HOLD_MS = 350;

let preload: Promise<void> | null = null;
/** Fetch the small Moon's code and the near-side imagery into the cache (once). */
export function preloadMoonDisc(): Promise<void> {
  if (!preload) preload = Promise.all([load3D().catch(() => undefined), warmCache(moonTileUrls(0, 0))]).then(() => undefined);
  return preload;
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[MoonDisc] 3D Moon failed, keeping the flat picture', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface MoonDiscProps {
  sunlit: boolean;
  /** Direction to the Sun in screen terms: x right, y up, z toward you. */
  sun?: [number, number, number];
  /** Called once the real Moon is on screen (fade the flat picture then). */
  onShow?: () => void;
  /** Positions the disc (absolute box over the flat Moon). */
  style?: CSSProperties;
  className?: string;
}

export function MoonDisc({ sunlit, sun, onShow, style, className }: MoonDiscProps) {
  const [webgl] = useState(hasWebGL);
  const [shown, setShown] = useState(false);
  const onReady = useCallback(
    () =>
      window.setTimeout(() => {
        setShown(true);
        onShow?.();
      }, READY_HOLD_MS),
    [onShow],
  );
  if (!webgl) return null;
  return (
    <div className={className} style={{ ...style, opacity: shown ? 1 : 0, transition: 'opacity 0.6s ease-out', pointerEvents: 'none' }} aria-hidden>
      <Boundary>
        <Suspense fallback={null}>
          <MoonDisc3D sunlit={sunlit} sun={sun} onReady={onReady} />
        </Suspense>
      </Boundary>
    </div>
  );
}
