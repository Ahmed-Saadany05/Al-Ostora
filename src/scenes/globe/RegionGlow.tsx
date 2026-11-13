/**
 * A soft white glow filling a whole region of the Moon (not just its outline). One transparent
 * shell just above the surface; each pixel works out its region from its own lat/lon with the same
 * rule as lib/moonFrame regionAt (±80° caps, far side beyond ±90° longitude). Levels ease in and
 * out so hovering feels smooth. Place it inside MoonTrekGlobe (Moon-fixed frame, metres).
 */
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { color } from '@/shared/theme/tokens';
import { MOON_RADIUS_M, POLAR_CAP_DEG, type RegionId } from '../lib/moonFrame';

const INDEX: Record<RegionId, number> = { 'south-pole': 0, 'north-pole': 1, nearside: 2, farside: 3 };
const HOVER_LEVEL = 0.34;
const ACTIVE_LEVEL = 0.16;

const vertexShader = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  void main() {
    vPos = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec4 uLevel;   // south, north, near, far
  uniform vec3 uColor;
  uniform float uCap;    // polar cap edge, radians
  varying vec3 vPos;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  void main() {
    vec3 p = normalize(vPos);
    float lat = asin(clamp(p.z, -1.0, 1.0));
    float lon = atan(p.y, p.x);
    float e = 0.012;   // soft edge, ~0.7°
    float south = 1.0 - smoothstep(-uCap - e, -uCap + e, lat);
    float north = smoothstep(uCap - e, uCap + e, lat);
    float band = (1.0 - south) * (1.0 - north);
    float near = band * (1.0 - smoothstep(-e, e, abs(lon) - 1.5707963));
    float far = band - near;
    float a = dot(uLevel, vec4(south, north, near, far));
    // Slightly stronger towards the limb, like light catching a haze on the shell.
    float rim = 1.0 - max(dot(vNormalView, vViewDir), 0.0);
    a *= 0.75 + 0.6 * rim;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export function RegionGlow({ hover, active, motion }: { hover: RegionId | null; active: RegionId | null; motion: boolean }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uLevel: { value: new THREE.Vector4() },
          uColor: { value: new THREE.Color(color.text) },
          uCap: { value: THREE.MathUtils.degToRad(POLAR_CAP_DEG) },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const target = useMemo(() => new THREE.Vector4(), []);

  useFrame((_, dt) => {
    target.set(0, 0, 0, 0);
    if (active) target.setComponent(INDEX[active], ACTIVE_LEVEL);
    if (hover) target.setComponent(INDEX[hover], HOVER_LEVEL);
    const level = material.uniforms.uLevel.value as THREE.Vector4;
    if (!motion) level.copy(target);
    else level.lerp(target, 1 - Math.exp(-Math.min(dt, 0.05) * 9));
  });

  return (
    <mesh material={material} renderOrder={3}>
      <sphereGeometry args={[MOON_RADIUS_M * 1.002, 160, 96]} />
    </mesh>
  );
}
