/**
 * Owner: Aser. Small Sun and Earth graphics shared by the mission pages (Step 4 touchdown result).
 * Moved here from the old Stand page when Stand switched to the 3D Moon view.
 */
import s from './flow.module.css';

const cls = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

/** Small glowing Sun in the Sun card: bright and breathing when sunlit, grey when in shadow. */
export function SunOrb({ on }: { on: boolean }) {
  return <span className={cls(s.sunOrb, on && s.sunOrbOn)} aria-hidden />;
}

/**
 * Mini Earth showing its real phase (illumination 0 = new … 1 = full), as seen from the Moon.
 * Lit shape = right half-disk + an ellipse whose width is r·|1 − 2k|: it bulges left past the
 * middle when more than half is lit (gibbous) and cuts in when less (crescent).
 * When in contact, radio rings pulse out of it.
 */
export function EarthPhase({ illumination, on }: { illumination: number; on: boolean }) {
  const r = 15;
  const c = 18;
  const k = Math.min(1, Math.max(0, illumination));
  const rx = r * Math.abs(1 - 2 * k);
  const lit = `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} A ${rx} ${r} 0 0 ${k > 0.5 ? 1 : 0} ${c} ${c - r} Z`;
  return (
    <span className={cls(s.earthWrap, on && s.earthOn)} aria-hidden>
      <span className={s.earthRing} />
      <span className={s.earthRing} />
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx={c} cy={c} r={r} className={s.earthDark} />
        <path d={lit} className={s.earthLit} />
      </svg>
    </span>
  );
}

