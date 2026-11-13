/**
 * Earth at true scale and position (see cinemaMath.ts), lit by the same Sun as the Moon so it shows a phase.
 * A plain blue sphere: no texture (so nothing to download or credit). Its libration loop is driven by the parent
 * through `earth.current.elev`; this component only places it, fades it in with the light, and tracks its label.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import { MeshStandardMaterial, Vector3, type Mesh } from 'three';
import { color } from '@/shared/theme/tokens';
import { earthPosition, EARTH_RADIUS, EARTH_DISTANCE, FOV } from './cinemaMath';
import type { CinemaGate } from './CinemaScene';

/** Earth is hidden by the dome when its centre is lower than about this angle above the horizon (its own radius). */
const VISIBLE_ABOVE_DEG = 0.6;
/** Earth is on the middle of the screen; it fades in as the light edge passes (fraction of viewport width). */
const EARTH_X = 0.5;

export function EarthLoop({
  earth,
  gate,
  labelEl,
}: {
  earth: RefObject<{ elev: number }>;
  gate: RefObject<CinemaGate>;
  labelEl: RefObject<HTMLElement | null>;
}) {
  const mesh = useRef<Mesh>(null);
  const { camera, size } = useThree();
  const tmp = useMemo(() => new Vector3(), []);
  const lastLabel = useRef('');
  const material = useMemo(() => new MeshStandardMaterial({ color: color.earth, roughness: 0.9, metalness: 0, transparent: true }), []);

  useFrame(() => {
    const m = mesh.current;
    if (!m || !earth.current) return;
    const elev = earth.current.elev;
    const [x, y, z] = earthPosition(elev);
    m.position.set(x, y, z);

    // Appears when the first light's edge reaches it.
    const edge = gate.current?.edge ?? 2;
    material.opacity = Math.min(1, Math.max(0, (edge - EARTH_X) / 0.08));

    const above = elev > VISIBLE_ABOVE_DEG;
    const label = labelEl.current;
    if (label) {
      const v = tmp.set(x, y, z).project(camera);
      // transform + opacity only; the label's own `translate` (CSS) right-aligns and centres it on this point.
      // Earth's on-screen radius in px, so the label clears the disc whatever the window size.
      const radiusPx = (EARTH_RADIUS / EARTH_DISTANCE / Math.tan((FOV * Math.PI) / 360)) * (size.height / 2);
      // Left of the disc: the pin's own label is on the right of the crest, so the two can never meet.
      const px = Math.round((v.x * 0.5 + 0.5) * size.width - radiusPx - 12);
      const py = Math.round((-v.y * 0.5 + 0.5) * size.height);
      const next = `${px},${py},${above && material.opacity > 0.9 ? 1 : 0}`;
      if (next !== lastLabel.current) {
        lastLabel.current = next;
        label.style.transform = `translate3d(${px}px, ${py}px, 0)`;
        label.style.opacity = above && material.opacity > 0.9 ? '1' : '0';
      }
    }
  });

  return (
    <mesh ref={mesh} material={material}>
      <sphereGeometry args={[EARTH_RADIUS, 48, 48]} />
    </mesh>
  );
}
