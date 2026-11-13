/**
 * STEP 1 — Site picker globe (owner: Pink). Props are fixed in contracts.ts (SitePickerGlobeProps).
 *
 * A 3D NASA Moon Trek globe (globe/PickerGlobe3D, loaded lazily) with site pins, region outlines
 * and click-to-pin coordinates. Without WebGL, or if the 3D view fails, it shows the flat map
 * (SitePickerMap) with the same props, so step 1 always works.
 */
import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { Pill } from '@/shared/ui';
import type { SitePickerGlobeProps } from './contracts';
import { SitePickerMap } from './SitePickerMap';
import g from './globe/globe.module.css';

const PickerGlobe3D = lazy(() => import('./globe/PickerGlobe3D'));

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
    <div className={g.frame} aria-busy="true">
      <div className={[g.hud, g.bottomBar].join(' ')}>
        <span className={g.glass}>
          <Pill icon="clock" label="Loading the 3D Moon…" />
        </span>
      </div>
    </div>
  );
}

export function SitePickerGlobe(props: SitePickerGlobeProps) {
  const [webgl] = useState(hasWebGL);
  const map = <SitePickerMap {...props} />;
  if (!webgl) return map;
  return (
    <GlobeBoundary fallback={map}>
      <Suspense fallback={<Loading />}>
        <PickerGlobe3D {...props} />
      </Suspense>
    </GlobeBoundary>
  );
}
