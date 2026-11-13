/**
 * PLACEHOLDER — owner: Pink. Text-and-progress stand-in for the 3D launch → landing.
 * Replace with the 3D sequence (real rocket + lander, never the Shuttle); keep LaunchSequenceProps.
 */
import { useEffect, useState } from 'react';
import { formatUtc } from '@/shared/format';
import { useApp } from '@/shared/store/app';
import { Button } from '@/shared/ui';
import type { LaunchSequenceProps } from './contracts';
import s from './placeholders.module.css';

const PHASES = ['Liftoff', 'Trans-lunar injection', 'Lunar orbit', 'Powered descent', 'Touchdown'];

export function LaunchSequence({ site, plan, onDone }: LaunchSequenceProps) {
  const motion = useApp((st) => st.motion);
  const [phase, setPhase] = useState(motion ? 0 : PHASES.length - 1);

  useEffect(() => {
    if (phase >= PHASES.length - 1) {
      const t = setTimeout(onDone, motion ? 900 : 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase((p) => p + 1), 1100);
    return () => clearTimeout(t);
  }, [phase, motion, onDone]);

  return (
    <div className={s.launch}>
      <p className={s.launchPhase}>{PHASES[phase]}</p>
      <div className={s.launchTrack}>
        <span className={s.launchFill} style={{ width: `${(phase / (PHASES.length - 1)) * 100}%` }} />
      </div>
      <p className={s.launchMeta}>
        <span className="num">{formatUtc(plan.launchDate)}</span> → {site.name} ·{' '}
        <span className="num">{formatUtc(plan.landingDate)}</span>
      </p>
      <Button variant="ghost" icon="arrowRight" onClick={onDone}>
        Skip
      </Button>
    </div>
  );
}
