/**
 * Edge drawer for the Moon view (Step 2). Hidden by default as a slim glass tab on the edge that
 * shows live values. Hover (or keyboard focus) slides the panel in and the tab fades away; leaving
 * slides it back after a short grace delay. Hover-only: no click-to-pin.
 * Animations use the motion tokens, so they are instant when motion is off.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import st from './stand.module.css';

/** Time to move from the tab into the panel (or back) without it closing. */
const CLOSE_DELAY_MS = 220;

export function PeekPanel({
  side,
  label,
  tab,
  children,
  className,
}: {
  side: 'left' | 'right' | 'bottom';
  /** Accessible name, e.g. "Sun and Earth". */
  label: string;
  /** What the hidden tab shows (live values). */
  tab: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const timer = useRef<number>(undefined);
  const open = hover || focus;
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const enter = () => {
    window.clearTimeout(timer.current);
    setHover(true);
  };
  const leave = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHover(false), CLOSE_DELAY_MS);
  };

  return (
    <div
      className={[st.peek, st[side], open && st.open, className].filter(Boolean).join(' ')}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={() => setFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false);
      }}
    >
      <div className={st.tab} tabIndex={0} role="button" aria-expanded={open} aria-label={`${label}: hover to show`}>
        {tab}
      </div>
      <div className={st.panel} inert={!open}>
        {children}
      </div>
    </div>
  );
}
