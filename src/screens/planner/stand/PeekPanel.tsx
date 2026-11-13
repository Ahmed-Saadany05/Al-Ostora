/**
 * Edge drawer for the Moon view (Step 2). Hidden by default as a slim glass tab on the edge that
 * shows live values; hovering (or keyboard focus) slides the panel in, leaving slides it back.
 * Clicking the tab pins it open; clicking again unpins it (back to hover-to-peek).
 * Animations use the motion tokens, so they are instant when motion is off.
 */
import { useState, type ReactNode } from 'react';
import { Icon } from '@/shared/ui';
import st from './stand.module.css';

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
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const open = pinned || hover || focus;

  return (
    <div
      className={[st.peek, st[side], open && st.open, pinned && st.pinned, className].filter(Boolean).join(' ')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false);
      }}
    >
      <button
        type="button"
        className={st.tab}
        aria-expanded={open}
        aria-pressed={pinned}
        aria-label={`${label}: ${pinned ? 'pinned open, click to hide' : 'click to keep open'}`}
        onClick={() => setPinned((p) => !p)}
      >
        {tab}
        <span className={st.pinMark} aria-hidden>
          <Icon name={pinned ? 'check' : 'plus'} size={11} />
        </span>
      </button>
      <div className={st.panel} inert={!open}>
        {children}
      </div>
    </div>
  );
}
