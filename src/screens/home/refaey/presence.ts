/**
 * Refaey's pop-ups (balloons and cards) animate in when they open and out when they close (Pink).
 * `usePresence(show)` keeps a closing pop-up mounted for its exit animation: `leaving` is true while it
 * animates out. Without motion (the app's setting or the system's reduced motion) it closes at once.
 * The animations themselves are `.popIn` / `.popOut` in refaey.module.css.
 */
import { useEffect, useState } from 'react';
import { useApp } from '@/shared/store/app';

/** Matches `.popOut` in refaey.module.css. */
export const POP_OUT_MS = 160;

export function usePresence(show: boolean) {
  const motion = useApp((st) => st.motion);
  const [kept, setKept] = useState(show);
  useEffect(() => {
    if (show) return setKept(true);
    if (!motion) return setKept(false);
    const t = window.setTimeout(() => setKept(false), POP_OUT_MS);
    return () => window.clearTimeout(t);
  }, [show, motion]);
  const leaving = !show && kept && motion;
  return { mounted: show || leaving, leaving, motion };
}
