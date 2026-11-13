import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { color } from '@/shared/theme/tokens';
import s from './StarLayers.module.css';

/** Three depth layers: [seed, density, max cursor shift in px]. Each has its own seed so stars never double up. */
const LAYERS = [
  { seed: 11, density: 0.00006, shift: 3 },
  { seed: 23, density: 0.00007, shift: 5 },
  { seed: 37, density: 0.00004, shift: 8 },
] as const;

function paint(canvas: HTMLCanvasElement, seed: number, density: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  let state = seed;
  const rand = () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646;
  const n = Math.round(w * h * density);
  ctx.fillStyle = color.text;
  for (let i = 0; i < n; i++) {
    const r = rand() < 0.92 ? 0.5 + rand() * 0.5 : 1 + rand() * 0.6;
    ctx.globalAlpha = 0.25 + rand() * 0.7;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Home's own star field: static (no twinkle), three layers that drift a few pixels with the cursor.
 * The root is what the intro fades in; `parallax` turns the cursor drift on.
 */
export function StarLayers({ parallax }: { parallax: boolean }) {
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    const draw = () => canvases.current.forEach((c, i) => c && paint(c, LAYERS[i].seed, LAYERS[i].density));
    draw();
    const ro = new ResizeObserver(draw);
    canvases.current[0] && ro.observe(canvases.current[0]);
    return () => ro.disconnect();
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
