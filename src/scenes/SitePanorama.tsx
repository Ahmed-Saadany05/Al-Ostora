/**
 * Step 2 (full) and Step 3 (compact) — the view from a site (owner: Pink). Props: contracts.ts.
 *
 * Full: the 3D "stand on the Moon" view (moonview/MoonView3D, loaded lazily): terrain, Sun and Earth
 * at their az/el from `sky`, their dotted sky paths over the lunar day (from useDayReport), labels.
 * Compact (Compare cards), or no WebGL / a 3D failure: the 2D horizon strip (SitePanoramaStrip).
 * All numbers come from the shared data hooks. Terrain: the site's real NASA grid
 * (src/data/terrain, Hagras) when exported, otherwise the placeholder; the far skyline is a ring
 * built from the site's horizon profile so the view always agrees with the cards.
 */
import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadRealTerrain } from '@/data/terrain';
import { nextTransition, useDayReport, useHorizon } from '@/shared/data';
import { formatDuration, hoursBetween } from '@/shared/format';
import { useTime } from '@/shared/store/time';
import { LUNAR, type SkyState } from '@/shared/types';
import type { SitePanoramaProps } from './contracts';
import { SitePanoramaStrip } from './SitePanoramaStrip';
import { interpolateSky } from './moonview/skyMath';
import { placeholderTerrain, seedFrom, type TerrainSource } from './moonview/terrain';
import type { SceneObject } from './moonview/SceneObjects';
import type { CamView, Clearing } from './moonview/MoonView3D';

export type { SceneObject };

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

/** Extra, optional: a fixed recorded sky (no day report, no paths) and hardware standing around you. */
export interface SitePanoramaExtras {
  dense?: boolean;
  fixedSky?: SkyState;
  objects?: SceneObject[];
  onObject?: (id: string) => void;
  selectedObject?: string;
  initialYawDeg?: number;
  aim?: { azDeg: number; elDeg: number; key: number };
  view?: CamView;
  clearings?: Clearing[];
  sceneExtras?: (terrain: TerrainSource) => ReactNode;
}

export function SitePanorama(props: SitePanoramaProps & SitePanoramaExtras) {
  const { site, time, sky, mode = 'stand', compact, dense, fixedSky, objects, onObject, selectedObject, initialYawDeg, aim, view, clearings, sceneExtras } = props;
  const [webgl] = useState(hasWebGL);
  const rangeStart = useTime((s) => s.rangeStart);
  // One lunar day of samples for the dotted Sun/Earth paths (cached by the data layer).
  const { data: report } = useDayReport(compact || !webgl || fixedSky ? undefined : site, rangeStart, LUNAR.synodicDays);
  // Real NASA terrain (LOLA / SLDEM2015) when the site has an exported grid; placeholder until then.
  const placeholder = useMemo(() => placeholderTerrain(seedFrom(site.id)), [site.id]);
  const [real, setReal] = useState<{ id: string; terrain: TerrainSource } | null>(null);
  useEffect(() => {
    if (compact || !webgl) return;
    let alive = true;
    loadRealTerrain(site.id, site.lat, site.lon).then((t) => alive && setReal(t ? { id: site.id, terrain: t } : null));
    return () => {
      alive = false;
    };
  }, [site.id, site.lat, site.lon, compact, webgl]);
  const terrain = real?.id === site.id ? real.terrain : placeholder;
  // The far skyline (beyond the 6 km patch) comes from the site's horizon profile.
  const { data: horizon } = useHorizon(compact || !webgl ? undefined : site);
  // The sky at exactly `time`, blended from the samples: no lag while scrubbing or in a timelapse.
  const live = useMemo(() => fixedSky ?? interpolateSky(report?.samples, time) ?? sky, [fixedSky, report, time, sky]);

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
          horizon={terrain.placeholder ? undefined : [props.horizon, horizon].find((h) => h && h.source !== 'demo')}
          mode={mode}
          dense={dense}
          objects={objects}
          onObject={onObject}
          selectedObject={selectedObject}
          initialYawDeg={initialYawDeg}
          aim={aim}
          view={view}
          clearings={clearings}
          sceneExtras={sceneExtras}
          sunLabel={{ next: live && !fixedSky ? nextLabel(report?.samples, time, 'sun', live.sunVisible) : null }}
          earthLabel={{ next: live && !fixedSky ? nextLabel(report?.samples, time, 'earth', live.earthVisible) : null }}
        />
      </Suspense>
    </ViewBoundary>
  );
}
