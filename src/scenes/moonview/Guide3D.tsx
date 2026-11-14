/**
 * A guide character standing on the terrain (Refaey in the past-mission stories): a camera-facing sprite drawn from
 * animation strips (idle, walk). He walks on the ground (terrain.heightAt) to `to` and idles there. One metres-per-pixel
 * scale for every strip so he never changes size between animations; the strip faces right and is flipped when he walks
 * left on screen. With motion off he is simply placed at `to`.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { TerrainSource } from './terrain';

export interface Strip {
  url: string;
  frameW: number;
  frameH: number;
  count: number;
  anchorX: number;
  /** Transparent rows under the boots. */
  feetGap: number;
  fps: number;
}

export interface Guide3DProps {
  terrain: TerrainSource;
  idle: Strip;
  walk: Strip;
  /** Where he stands (metres east, south). */
  to: { x: number; z: number };
  /** Where he starts the first time (defaults to `to`). */
  from?: { x: number; z: number };
  /** His height (the idle strip's frame), metres. */
  heightM?: number;
  /** Walking speed, m/s (a lunar lope). */
  speed?: number;
  motion: boolean;
}

function useStripTexture(s: Strip) {
  return useMemo(() => {
    const tex = new THREE.TextureLoader().load(s.url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.repeat.set(1 / s.count, 1);
    return tex;
  }, [s.url, s.count]);
}

export function Guide3D({ terrain, idle, walk, to, from, heightM = 1.8, speed = 4, motion }: Guide3DProps) {
  const camera = useThree((st) => st.camera);
  const idleTex = useStripTexture(idle);
  const walkTex = useStripTexture(walk);
  const material = useMemo(() => new THREE.SpriteMaterial({ map: idleTex, transparent: true, alphaTest: 0.4, depthWrite: true }), [idleTex]);
  const sprite = useRef<THREE.Sprite>(null);
  // x = east, y = south (a 2D point on the ground).
  const pos = useRef(new THREE.Vector2(from?.x ?? to.x, from?.z ?? to.z));
  const facingLeft = useRef(false);
  const clock = useRef(0);
  const metresPerPx = heightM / idle.frameH;
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => () => {
    material.dispose();
    idleTex.dispose();
    walkTex.dispose();
  }, [material, idleTex, walkTex]);

  useFrame((_, dtRaw) => {
    const s = sprite.current;
    if (!s) return;
    const dt = Math.min(dtRaw, 0.05);
    clock.current += dt;
    const p = pos.current;
    const dx = to.x - p.x;
    const dz = to.z - p.y;
    const dist = Math.hypot(dx, dz);
    const walking = motion && dist > 0.05;
    if (!motion) p.set(to.x, to.z);
    else if (walking) {
      const step = Math.min(dist, speed * dt);
      const ox = p.x;
      const oz = p.y;
      p.x += (dx / dist) * step;
      p.y += (dz / dist) * step;
      // Facing: which way he moves on screen.
      a.set(ox, terrain.heightAt(ox, oz), oz).project(camera);
      b.set(p.x, terrain.heightAt(p.x, p.y), p.y).project(camera);
      if (Math.abs(b.x - a.x) > 1e-5) facingLeft.current = b.x < a.x;
    }

    const strip = walking ? walk : idle;
    const tex = walking ? walkTex : idleTex;
    if (material.map !== tex) {
      material.map = tex;
      material.needsUpdate = true;
    }
    const frame = Math.floor(clock.current * strip.fps) % strip.count;
    const left = facingLeft.current;
    tex.repeat.set((left ? -1 : 1) / strip.count, 1);
    tex.offset.set((left ? frame + 1 : frame) / strip.count, 0);
    s.scale.set(strip.frameW * metresPerPx, strip.frameH * metresPerPx, 1);
    s.center.set(left ? 1 - strip.anchorX / strip.frameW : strip.anchorX / strip.frameW, strip.feetGap / strip.frameH);
    s.position.set(p.x, terrain.heightAt(p.x, p.y) - 0.02, p.y);
  });

  return <sprite ref={sprite} material={material} renderOrder={2} />;
}
