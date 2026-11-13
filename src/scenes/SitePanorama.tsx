/**
 * Step 2 (full) and Step 3 (compact) — the view from a site (owner: Pink). Props: contracts.ts.
 *
 * Full: the 3D "stand on the Moon" view (moonview/MoonView3D, loaded lazily): terrain, Sun and Earth
 * at their az/el from `sky`, their dotted sky paths over the lunar day (from useDayReport), labels.
 * Compact (Compare cards), or no WebGL / a 3D failure: the 2D horizon strip (SitePanoramaStrip).
 * All numbers come from the shared data hooks. Terrain (Aser): the real LOLA skyline when the site has one
 * (horizonTerrain), otherwise the placeholder; both with procedural realism (withRealism).
 */
import { Component, lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { nextTransition, useDayReport } from '@/shared/data';
import { formatDuration, hoursBetween } from '@/shared/format';
import { useTime } from '@/shared/store/time';
import { LUNAR, type SkyState } from '@/shared/types';
import type { SitePanoramaProps } from './contracts';
import { SitePanoramaStrip } from './SitePanoramaStrip';
import { interpolateSky } from './moonview/skyMath';
import { horizonTerrain, placeholderTerrain, seedFrom, withRealism } from './moonview/terrain';

const MoonView3D = lazy(() => import('./moonview/MoonView3D'));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

class ViewBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[SitePanorama] 3D view failed, showing the 2D strip', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** "Sets in 14d 6h" / "Rises in 3h" from the day report, or null when not in range. */
function nextLabel(samples: SkyState[] | undefined, time: string, kind: 'sun' | 'earth', visible: boolean) {
  if (!samples) return null;
  const ahead = samples.filter((x) => x.time >= time);
  const next = nextTransition(ahead, kind === 'sun' ? (x) => x.sunVisible : (x) => x.earthVisible, visible);
  if (!next) return null;
  const h = hoursBetween(time, next);
  return h > 0 ? `${visible ? 'Sets' : 'Rises'} in ${formatDuration(h)}` : null;
}

export function SitePanorama(props: SitePanoramaProps & { dense?: boolean }) {
  const { site, time, sky, mode = 'stand', compact, dense } = props;
  const [webgl] = useState(hasWebGL);
  const rangeStart = useTime((s) => s.rangeStart);
  // One lunar day of samples for the dotted Sun/Earth paths (cached by the data layer).
  const { data: report } = useDayReport(compact || !webgl ? undefined : site, rangeStart, LUNAR.synodicDays);
  // Real skyline when this site has a LOLA horizon (live data, 15 polar sites); else the placeholder.
  // Realism detail on top; on the real skyline it only carves beyond the flat area, so it stays exact.
  const realHorizon = props.horizon?.terrain === 'lola' ? props.horizon : undefined;
  const terrain = useMemo(() => {
    const seed = seedFrom(site.id);
    if (!realHorizon) return withRealism(placeholderTerrain(seed), seed);
    const ring = horizonTerrain(realHorizon);
    return withRealism(ring, seed, ring.rockRadius);
  }, [realHorizon, site.id]);
  // The sky at exactly `time`, blended from the samples: no lag while scrubbing or in a timelapse.
  const live = useMemo(() => interpolateSky(report?.samples, time) ?? sky, [report, time, sky]);

  const strip = <SitePanoramaStrip {...props} />;
  if (compact || !webgl) return strip;
  return (
    <ViewBoundary fallback={strip}>
      <Suspense fallback={null}>
        <MoonView3D
          sky={live}
          site={{ lat: site.lat, lon: site.lon, name: site.kind === 'custom' ? 'your pin' : site.name }}
          samples={report?.samples}
          terrain={terrain}
          mode={mode}
          dense={dense}
          sunLabel={{ next: live ? nextLabel(report?.samples, time, 'sun', live.sunVisible) : null }}
          earthLabel={{ next: live ? nextLabel(report?.samples, time, 'earth', live.earthVisible) : null }}
        />
      </Suspense>
    </ViewBoundary>
  );
}
