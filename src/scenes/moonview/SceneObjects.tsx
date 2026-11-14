/**
 * Hardware standing on the terrain (past-mission landers, rovers, instruments) and the clickable labels over it.
 * Models are glTF files in /public/models (Y up, 1 unit = 1 m, origin at the bottom centre), loaded lazily, each in its
 * own Suspense so the terrain never waits for them. Every model is set on the ground with terrain.heightAt.
 */
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Suspense, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { TerrainSource } from './terrain';

export interface SceneObject {
  id: string;
  url: string;
  label: string;
  /** Metres east (x) and south (z) of where you stand. */
  x: number;
  z: number;
  yawDeg?: number;
  /** Tip it onto its side (degrees about its forward axis). */
  rollDeg?: number;
}

const D2R = Math.PI / 180;

function Model({ obj, terrain, tops }: { obj: SceneObject; terrain: TerrainSource; tops: MutableRefObject<Map<string, THREE.Vector3>> }) {
  const { scene } = useGLTF(obj.url);
  const clone = useMemo(() => scene.clone(true), [scene]);
  const inner = useRef<THREE.Group>(null);
  const ground = useMemo(() => terrain.heightAt(obj.x, obj.z), [terrain, obj.x, obj.z]);

  // Sit the (possibly tipped) model on the ground: its lowest point at ground level, then remember its top for the label.
  useLayoutEffect(() => {
    const g = inner.current;
    if (!g) return;
    g.position.y = 0;
    g.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(g);
    g.position.y = ground - box.min.y - 0.03; // 3 cm into the dust (the outer group only turns, so y offsets carry over)
    tops.current.set(obj.id, new THREE.Vector3(obj.x, ground + (box.max.y - box.min.y) + 0.4, obj.z));
    return () => void tops.current.delete(obj.id);
  }, [clone, ground, obj.id, obj.x, obj.z, tops]);

  return (
    <group position={[obj.x, ground, obj.z]} rotation={[0, (obj.yawDeg ?? 0) * D2R, 0]}>
      <group ref={inner} rotation={[0, 0, (obj.rollDeg ?? 0) * D2R]}>
        <primitive object={clone} />
      </group>
    </group>
  );
}

export function SceneObjects({ objects, terrain, tops }: { objects: SceneObject[]; terrain: TerrainSource; tops: MutableRefObject<Map<string, THREE.Vector3>> }) {
  return (
    <>
      {objects.map((o) => (
        <Suspense key={o.id} fallback={null}>
          <Model obj={o} terrain={terrain} tops={tops} />
        </Suspense>
      ))}
    </>
  );
}

/** Moves each object's label element over the top of its model. */
export function ObjectLabelProjector({ tops, els }: { tops: MutableRefObject<Map<string, THREE.Vector3>>; els: MutableRefObject<Map<string, HTMLElement>> }) {
  const p = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const [id, el] of els.current) {
      const top = tops.current.get(id);
      if (!top) {
        if (el.dataset.hidden !== 'true') el.dataset.hidden = 'true';
        continue;
      }
      p.copy(top).project(camera);
      const hidden = String(p.z > 1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1);
      if (el.dataset.hidden !== hidden) el.dataset.hidden = hidden;
      el.style.transform = `translate3d(${((p.x + 1) / 2) * size.width}px, ${((1 - p.y) / 2) * size.height}px, 0)`;
    }
  });
  return null;
}
