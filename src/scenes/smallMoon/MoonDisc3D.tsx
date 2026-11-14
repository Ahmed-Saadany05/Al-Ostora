/**
 * A small real Moon (NASA Moon Trek imagery) seen face-on: the near side toward you, north up, east
 * to the right — the same view as a near-side map picture, so marks drawn over it (a site pin from
 * an orthographic formula, a rim) line up. Lit from `sun` (camera axes); dimmed when not `sunlit`.
 * Loaded lazily by MoonDisc. Owner: Pink.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Mesh, MeshBasicMaterial } from 'three';
import { MoonTrekGlobe } from '../globe/MoonTrekGlobe';
import { createMoonLight } from '../globe/moonShading';

export interface MoonDisc3DProps {
  sunlit: boolean;
  /** Direction to the Sun in screen terms: x right, y up, z toward you. */
  sun?: [number, number, number];
  /** Once, when the imagery has loaded. */
  onReady?: () => void;
}

/** Narrow lens far away: almost orthographic, so the disc matches a flat near-side picture. */
const FOV = 8;
const DISTANCE = 1 / Math.sin(((FOV / 2) * Math.PI) / 180);

/**
 * Ready = a Moon tile actually has its imagery texture. (On a disc this small the tiles library may
 * never fire its "load end" event, so this checks for itself, a few times a second.)
 */
function ReadyWhenTextured({ onReady }: { onReady?: () => void }) {
  const scene = useThree((s) => s.scene);
  const done = useRef(false);
  const frame = useRef(0);
  useFrame(() => {
    if (done.current || ++frame.current % 10 !== 0) return;
    let textured = false;
    scene.traverse((o) => {
      const map = ((o as Mesh).material as MeshBasicMaterial | undefined)?.map;
      if ((o as Mesh).isMesh && map?.image) textured = true;
    });
    if (textured) {
      done.current = true;
      onReady?.();
    }
  });
  return null;
}

export default function MoonDisc3D({ sunlit, sun = [0.6, 0.45, 0.65], onReady }: MoonDisc3DProps) {
  const light = useMemo(createMoonLight, []);
  // Report ready once, whichever signal comes first.
  const reported = useRef(false);
  const ready = () => {
    if (reported.current) return;
    reported.current = true;
    onReady?.();
  };
  useMemo(() => {
    // Camera on +X looking at the Moon: screen right = −Z (east), up = +Y, toward you = +X.
    const [x, y, z] = sun;
    light.uSun.value.set(z, y, -x).normalize();
    light.uExposure.value = sunlit ? 1.2 : 0.45;
    light.uNightFloor.value = sunlit ? 0.05 : 0.2;
  }, [light, sun, sunlit]);
  return (
    <Canvas camera={{ fov: FOV, near: 0.1, far: 100, position: [DISTANCE, 0, 0] }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <MoonTrekGlobe light={light} onImageryReady={ready} />
      <ReadyWhenTextured onReady={ready} />
    </Canvas>
  );
}
