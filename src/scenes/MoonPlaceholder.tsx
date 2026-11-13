/**
 * PLACEHOLDER — owner: Pink. Replace with the Moon Trek globe.
 * Exists so the R3F pipeline is proven to work on `main` from day one.
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh } from 'three';
import { useApp } from '@/shared/store/app';

function Sphere() {
  const ref = useRef<Mesh>(null);
  const motion = useApp((s) => s.motion);
  useFrame((_, dt) => {
    if (motion && ref.current) ref.current.rotation.y += dt * 0.03;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 96, 96]} />
      <meshStandardMaterial color="#8d8d8a" roughness={1} metalness={0} />
    </mesh>
  );
}

export function MoonPlaceholder() {
  return (
    <Canvas camera={{ position: [0, 0, 2.95], fov: 40 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      {/* Low, grazing sunlight — like the south pole. */}
      <directionalLight position={[-4, 1.2, 1.5]} intensity={2.6} />
      <ambientLight intensity={0.04} />
      <Sphere />
    </Canvas>
  );
}
