/**
 * 2D 360° horizon strip (owner: Pink): real horizon profile, Sun and Earth at their real
 * azimuth/elevation, drag to look around. Used for the compact Compare cards, and as the
 * fallback when WebGL is unavailable. Same props as SitePanorama.
 */
import { useRef, useState, type PointerEvent } from 'react';
import { formatDeg } from '@/shared/format';
import type { SitePanoramaProps } from './contracts';
import s from './placeholders.module.css';

const wrap = (a: number) => ((a % 360) + 360) % 360;
const COMPASS = [
  [0, 'N'],
  [90, 'E'],
  [180, 'S'],
  [270, 'W'],
] as const;

export function SitePanoramaStrip({ sky, horizon, compact }: SitePanoramaProps) {
  const fov = compact ? 360 : 200;
  const [offset, setOffset] = useState<number | null>(null);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const elevs = horizon?.elevationsDeg ?? [];
  const bodies = sky ? [sky.sun.elDeg, sky.earth.elDeg].filter((e) => e > -10) : [];
  const top = Math.min(90, Math.max(compact ? 6 : 8, ...bodies.map((e) => e + 3), ...elevs.map((e) => e + 2)));
  const bottom = Math.min(-3, ...elevs.map((e) => e - 2));
  const span = top - bottom;

  // Start looking toward the Sun (or Earth if the Sun is down).
  const focus = sky ? (sky.sunVisible || !sky.earthVisible ? sky.sun.azDeg : sky.earth.azDeg) : 0;
  const left = compact ? 0 : wrap(offset ?? focus - fov / 2);

  const step = horizon?.azStepDeg ?? 1;
  const pts = elevs.length
    ? Array.from({ length: elevs.length * 2 + 1 }, (_, i) => `${i * step},${(top - elevs[i % elevs.length]).toFixed(3)}`).join(' ')
    : '';
  const ground = pts ? `0,${span + 1} ${pts} 720,${span + 1}` : '';

  const x = (az: number) => {
    const d = wrap(az - left);
    return d <= fov ? (d / fov) * 100 : null;
  };
  const y = (el: number) => Math.min(100, Math.max(0, ((top - el) / span) * 100));

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (compact) return;
    drag.current = { x: e.clientX, start: left };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !box.current) return;
    const dx = e.clientX - drag.current.x;
    setOffset(wrap(drag.current.start - (dx / box.current.clientWidth) * fov));
  };
  const onUp = () => (drag.current = null);

  const marker = (kind: 'sun' | 'earth') => {
    if (!sky) return null;
    const b = sky[kind];
    const px = x(b.azDeg);
    if (px === null) return null;
    const visible = kind === 'sun' ? sky.sunVisible : sky.earthVisible;
    return (
      <div
        key={kind}
        className={[s.body, s[kind], !visible && s.hidden].filter(Boolean).join(' ')}
        style={{ left: `${px}%`, top: `${y(b.elDeg)}%` }}
      >
        <span className={s.bodyDisk} />
        {!compact && (
          <span className={s.bodyTag}>
            <b>{kind === 'sun' ? 'Sun' : 'Earth'}</b>
            <span className="num">{formatDeg(b.elDeg, 1)}</span>
            {!visible && <em>behind terrain</em>}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      ref={box}
      className={[s.pano, compact && s.panoCompact].filter(Boolean).join(' ')}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="img"
      aria-label={
        sky
          ? `Horizon view. Sun ${formatDeg(sky.sun.elDeg, 1)}, ${sky.sunVisible ? 'visible' : 'hidden'}. Earth ${formatDeg(sky.earth.elDeg, 1)}, ${sky.earthVisible ? 'visible' : 'hidden'}.`
          : 'Horizon view loading'
      }
    >
      <svg className={s.panoSvg} viewBox={`${left} 0 ${fov} ${span}`} preserveAspectRatio="none" aria-hidden>
        {ground && <polygon points={ground} className={s.ground} />}
        {pts && <polyline points={pts} className={s.skyline} vectorEffect="non-scaling-stroke" />}
        <line x1={0} x2={720} y1={top} y2={top} className={s.flat} vectorEffect="non-scaling-stroke" />
      </svg>
      {marker('earth')}
      {marker('sun')}
      {!compact &&
        COMPASS.flatMap(([az, label]) => {
          const px = x(az);
          return px === null ? [] : [<span key={label} className={s.compass} style={{ left: `${px}%` }}>{label}</span>];
        })}
      {!compact && <span className={s.dragHint}>↔ Drag to look around · placeholder view</span>}
    </div>
  );
}
