/**
 * Slowly drifting star canvas: stars are generated once (seeded, so they never jump), then redrawn
 * shifted sideways and wrapped around the edge — like the sky turning. About 30 redraws a second,
 * a few hundred dots each, so it is cheap. Stops when motion is off (the user toggle or the OS
 * reduced-motion setting) and draws one still frame instead. Returns a cleanup function.
 */
import { useApp } from '../store/app';

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
}

export interface DriftOptions {
  seed: number;
  /** Stars per square CSS pixel. */
  density: number;
  /** Drift speed, CSS pixels per second (positive = towards the left). */
  speed: number;
  fill: string;
}

const osReduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function startStarDrift(canvas: HTMLCanvasElement, { seed, density, speed, fill }: DriftOptions): () => void {
  let stars: Star[] = [];
  let w = 0;
  let h = 0;
  let dpr = 1;
  let offset = 0;
  let raf = 0;
  let last = 0;

  const build = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
    let state = seed;
    const rand = () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646;
    const n = Math.round(w * h * density);
    stars = Array.from({ length: n }, () => {
      const r = rand() < 0.92 ? 0.5 + rand() * 0.5 : 1 + rand() * 0.6;
      return { r, a: 0.25 + rand() * 0.7, x: rand() * w, y: rand() * h };
    });
  };

  const draw = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx || w === 0) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = fill;
    for (const s of stars) {
      const x = (((s.x - offset) % w) + w) % w;
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const moving = () => useApp.getState().motion && !osReduced();

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(now - last, 100) : 0;
    if (dt < 30 && last) return; // ~30 fps is plenty for a slow drift
    last = now;
    if (!moving()) return;
    offset = (offset + (speed * dt) / 1000) % Math.max(w, 1);
    draw();
  };

  build();
  draw();
  raf = requestAnimationFrame(loop);
  const ro = new ResizeObserver(() => {
    build();
    draw();
  });
  ro.observe(canvas);
  // Redraw the still frame immediately when motion is switched off or on.
  const unsub = useApp.subscribe(() => draw());

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    unsub();
  };
}
