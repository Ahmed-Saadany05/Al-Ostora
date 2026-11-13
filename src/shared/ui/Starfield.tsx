import { useEffect, useRef } from 'react';
import s from './Starfield.module.css';

/**
 * Static star background (canvas, drawn once per resize — no animation cost).
 * Decorative only: real star positions are not implied.
 */
export function Starfield({ density = 0.00018 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      let seed = 7;
      const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      const n = Math.round(w * h * density);
      for (let i = 0; i < n; i++) {
        const r = rand() < 0.92 ? 0.5 + rand() * 0.5 : 1 + rand() * 0.6;
        ctx.globalAlpha = 0.25 + rand() * 0.7;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [density]);

  return <canvas ref={ref} className={s.stars} aria-hidden />;
}
