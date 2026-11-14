/**
 * Step 5 — launch → arrival (owner: Pink). Props fixed in contracts.ts (LaunchSequenceProps).
 *
 * The Earth–Moon orbit timelapse (launch/LaunchOrbit3D, loaded lazily) for the planned launch and
 * landing dates. Positions come from an OrbitProvider: `placeholderOrbit` for now (approximate Moon
 * orbit + a stand-in trajectory); the engine's can replace it here. Skip at any time; with motion off
 * it opens at arrival. It ends when the user taps the Moon (or skips). Without WebGL, a short text
 * version plays instead.
 */
import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { formatUtc } from '@/shared/format';
import { useApp } from '@/shared/store/app';
import { Button } from '@/shared/ui';
import type { LaunchSequenceProps } from './contracts';
import { placeholderOrbit } from './launch/orbit';
import l from './launch/launch.module.css';
import s from './placeholders.module.css';

const LaunchOrbit3D = lazy(() => import('./launch/LaunchOrbit3D'));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[LaunchSequence] 3D orbit failed, showing the text version', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Text stand-in (no WebGL, or the 3D view failed). */
function TextSequence({ site, plan, onDone }: LaunchSequenceProps) {
  const PHASES = ['Liftoff', 'Trans-lunar injection', 'Coasting to the Moon', 'Arrival'];
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (phase >= PHASES.length - 1) {
      const t = setTimeout(onDone, 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase((p) => p + 1), 1100);
    return () => clearTimeout(t);
  }, [phase, onDone, PHASES.length]);
  return (
    <div className={s.launch}>
      <p className={s.launchPhase}>{PHASES[phase]}</p>
      <div className={s.launchTrack}>
        <span className={s.launchFill} style={{ width: `${(phase / (PHASES.length - 1)) * 100}%` }} />
      </div>
      <p className={s.launchMeta}>
        <span className="num">{formatUtc(plan.launchDate)}</span> → {site.name} · <span className="num">{formatUtc(plan.landingDate)}</span>
      </p>
    </div>
  );
}

export function LaunchSequence(props: LaunchSequenceProps) {
  const { site, plan, onDone } = props;
  const motion = useApp((st) => st.motion);
  const [webgl] = useState(hasWebGL);
  const text = <TextSequence {...props} />;
  return (
    <div className={l.stage}>
      {webgl ? (
        <Boundary fallback={text}>
          <Suspense fallback={null}>
            <LaunchOrbit3D
              provider={placeholderOrbit}
              launchIso={plan.launchDate}
              arrivalIso={plan.landingDate}
              siteName={site.kind === 'custom' ? 'your pin' : site.name}
              instant={!motion}
              onDone={onDone}
            />
          </Suspense>
        </Boundary>
      ) : (
        text
      )}
      <div className={l.skip}>
        <Button variant="ghost" icon="arrowRight" onClick={onDone}>
          Skip to landing
        </Button>
      </div>
    </div>
  );
}
