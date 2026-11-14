/**
 * Owner: Aser. Mini 3D scene for one Compare column, rendered through ONE shared <Canvas> with drei
 * <View> (see ComparePage), so 5 scenes don't hit the browser's WebGL context limit.
 *
 * What it shows (from data, nothing invented):
 *  - The site's real skyline (useHorizon → elevationsDeg per azimuth) as a 3D ring of terrain
 *    around the observer at the centre.
 *  - The Sun and Earth at their azimuth / flat-horizon elevation for the chosen moment (a sample
 *    from useDayReport), each with a ray from the observer. The ray is solid when the body is
 *    visible above the skyline (sunVisible / earthVisible from the provider), dashed when blocked.
 *  - Heights and elevations use the same stretch (shown(): ×EXAG for small angles, eased to 50°
 *    max), so who is above whom stays true; at the pole everything is within a few degrees.
 * North is −z, east is +x. The camera orbits slowly; drag to look around.
 */
import { Line, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { BodyPosition, HorizonProfile, SkyState } from '@/shared/types';

export const EXAG = 6;
const R = 8; // skyline ring radius
const BODY_R = 10.5; // where the Sun / Earth are drawn (just outside the skyline ring)

/** Read a colour token from the page so the scene matches the design system. */
function token(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Displayed elevation: small angles stretched ×EXAG, large ones eased so they stay in view
 * (50° max). It only ever increases with the real angle, so "above / below the ridge" stays true.
 */
const shown = (elDeg: number) => 50 * Math.tanh((elDeg * EXAG) / 50);

/** Unit direction for an azimuth (from north, clockwise) and an elevation (displayed). */
function dir(azDeg: number, elDeg: number) {
  const az = (azDeg * Math.PI) / 180;
  const el = (shown(elDeg) * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

function Terrain({ horizon, color, edge }: { horizon?: HorizonProfile; color: string; edge: string }) {
  const { geometry, ridge } = useMemo(() => {
    const els = horizon?.elevationsDeg?.length ? horizon.elevationsDeg : Array.from({ length: 72 }, () => 0);
    const n = els.length;
    const pos: number[] = [];
    const ridgePts: [number, number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const az = ((i % n) / n) * Math.PI * 2;
      const h = Math.max(0.06, R * Math.tan((shown(Math.max(-5, els[i % n])) * Math.PI) / 180));
      const x = Math.sin(az) * R;
      const z = -Math.cos(az) * R;
      pos.push(x, 0, z, x, h, z);
      ridgePts.push([x, h, z]);
    }
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return { geometry: g, ridge: ridgePts };
  }, [horizon]);
  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.95} flatShading />
      </mesh>
      <Line points={ridge} color={edge} lineWidth={1} transparent opacity={0.8} />
    </>
  );
}

function Body({ body, visible, color, size }: { body: BodyPosition; visible: boolean; color: string; size: number }) {
  const p = dir(body.azDeg, body.elDeg).multiplyScalar(BODY_R);
  const eye: [number, number, number] = [0, 0.25, 0];
  return (
    <>
      <mesh position={p}>
        <sphereGeometry args={[size, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={visible ? 1 : 0.35} />
      </mesh>
      <mesh position={p}>
        <sphereGeometry args={[size * 2.2, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={visible ? 0.16 : 0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <Line
        points={[eye, [p.x, p.y, p.z]]}
        color={color}
        lineWidth={visible ? 1.6 : 1}
        dashed={!visible}
        dashSize={0.4}
        gapSize={0.35}
        transparent
        opacity={visible ? 0.9 : 0.4}
      />
    </>
  );
}

export function SiteScene({ sample, horizon, still }: { sample?: SkyState; horizon?: HorizonProfile; still: boolean }) {
  const colors = useMemo(
    () => ({
      sun: token('--color-sun', '#f4c26b'),
      earth: token('--color-earth', '#7cb4ff'),
      terrain: token('--color-text-faint', '#6b6b69'),
      ground: token('--color-surface-raised', '#131315'),
      edge: token('--color-text-muted', '#a8a8a6'),
      text: token('--color-text', '#f5f5f4'),
    }),
    [],
  );
  const sunlit = sample?.sunVisible ?? false;
  const sunDir = sample ? dir(sample.sun.azDeg, Math.max(0.5, sample.sun.elDeg)).multiplyScalar(30) : new THREE.Vector3(10, 10, 10);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 13, 27]} fov={42} />
      <OrbitControls makeDefault enableZoom={false} enablePan={false} autoRotate={!still} autoRotateSpeed={0.6} minPolarAngle={0.55} maxPolarAngle={1.42} />
      <ambientLight intensity={sunlit ? 0.9 : 0.45} />
      <directionalLight position={sunDir} intensity={sunlit ? 2.4 : 0.12} color={colors.sun} />
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[R, 64]} />
        <meshStandardMaterial color={colors.ground} roughness={1} />
      </mesh>
      <Terrain horizon={horizon} color={colors.terrain} edge={colors.edge} />
      {/* You (the lander) at the centre */}
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshBasicMaterial color={colors.text} />
      </mesh>
      {sample && <Body body={sample.sun} visible={sample.sunVisible} color={colors.sun} size={0.85} />}
      {sample && <Body body={sample.earth} visible={sample.earthVisible} color={colors.earth} size={0.7} />}
    </>
  );
}
