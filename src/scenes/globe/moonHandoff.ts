/**
 * Home → Step 1 hand-off. The Home Moon marks the moment it was clicked; Step 1's globe checks for a
 * fresh mark when it mounts and, if there is one, flies in from a close-up of the south pole (where
 * the Home dome's crest is) out to the full Moon, so the two pages read as one continuous move.
 */
const FRESH_MS = 3000;
let markedAt = 0;

export function markMoonHandoff() {
  markedAt = performance.now();
}

/** True once, right after the Home Moon was clicked. */
export function takeMoonHandoff(): boolean {
  const fresh = markedAt > 0 && performance.now() - markedAt < FRESH_MS;
  markedAt = 0;
  return fresh;
}

/** Start loading Step 1's 3D chunk early, so the flight starts without a loading flash. */
export const preloadPickerGlobe = () => import('./PickerGlobe3D');
