import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { color } from '@/shared/theme/tokens';
import { startStarDrift } from '@/shared/ui/starDrift';
import s from './StarLayers.module.css';

/**
 * Three depth layers: seed, density, max cursor shift in px, and drift speed in px/s (nearer layers
 * drift faster, for depth). Each has its own seed so stars never double up.
 */
const LAYERS = [
  { seed: 11, density: 0.00006, shift: 3, speed: 2 },
  { seed: 23, density: 0.00007, shift: 5, speed: 3.5 },
  { seed: 37, density: 0.00004, shift: 8, speed: 5.5 },
] as const;

/**
 * Home's own star field: three layers drifting slowly sideways at different speeds (paused when
 * motion is off), which also shift a few pixels with the cursor.
 * The root is what the intro fades in; `parallax` turns the cursor drift on.
 */
export function StarLayers({ parallax }: { parallax: boolean }) {
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    const stops = canvases.current.map((c, i) =>
      c ? startStarDrift(c, { seed: LAYERS[i].seed, density: LAYERS[i].density, speed: LAYERS[i].speed, fill: color.text }) : () => {},
    );
    return () => stops.forEach((stop) => stop());
  }, []);

  useEffect(() => {
    if (!parallax) return;
    const movers = layers.current.map((el, i) =>
      el ? { x: gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3.out' }), y: gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3.out' }), shift: LAYERS[i].shift } : null,
    );
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      movers.forEach((m) => {
        if (!m) return;
        m.x(-nx * m.shift);
        m.y(-ny * m.shift);
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      // Kill the running tweens first, or they carry on toward the old cursor position and undo the reset.
      layers.current.forEach((el) => {
        if (!el) return;
        gsap.killTweensOf(el);
        gsap.set(el, { x: 0, y: 0 });
      });
    };
  }, [parallax]);

  return (
    <div className={s.root} aria-hidden>
      {LAYERS.map((l, i) => (
        <div key={l.seed} ref={(el) => {
            layers.current[i] = el;
          }} className={s.layer}>
          <canvas ref={(el) => {
              canvases.current[i] = el;
            }} className={s.canvas} />
        </div>
      ))}
    </div>
  );
}
