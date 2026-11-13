import { useEffect, useRef } from 'react';
import { color } from '../theme/tokens';
import { startStarDrift } from './starDrift';
import s from './Starfield.module.css';

/**
 * Star background that drifts slowly sideways (paused when motion is off).
 * Decorative only: real star positions are not implied.
 */
export function Starfield({ density = 0.00018 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return startStarDrift(canvas, { seed: 7, density, speed: 4, fill: color.text });
  }, [density]);

  return <canvas ref={ref} className={s.stars} aria-hidden />;
}
