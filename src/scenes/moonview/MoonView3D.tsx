/**
 * STAND ON SITE — the 3D Moon view (owner: Pink). Loaded lazily by SitePanorama.
 *
 * You stand on the site: terrain around you (TerrainSource — a placeholder until LOLA heights are
 * wired), black sky and stars, the Sun and Earth at their az/el from SkyState (real angular sizes,
 * Earth's phase from the Sun's direction), their dotted paths across the sky over the lunar day
 * (from DayReport samples), a dashed horizon and N/E/S/W marks. Labels over the Sun and Earth are
 * DOM elements that follow them. Drag to look around 360°.
 * "Fly above" eases the camera up to 15 km: the local terrain fades into the real Moon Trek globe
 * (true radius) laid under the site, so the curved horizon shows instead of the edge of a block.
 * The sky (stars, Sun, Earth, paths) is a dome that follows the camera, far beyond the ground.
 * Every number comes from props (the data hooks); nothing here invents values.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import * as THREE from 'three';
import { formatDeg } from '@/shared/format';
import { DEFAULT_SUN, MoonTrekGlobe } from '../globe/MoonTrekGlobe';
import { enuAxes, MOON_RADIUS_M, type Vec3 } from '../lib/moonFrame';
import { color } from '@/shared/theme/tokens';
import type { HorizonProfile, SkyState } from '@/shared/types';
import { azElToLocal, skyPathSegments, type Vec3Tuple } from './skyMath';
import { type TerrainSource } from './terrain';
import { detailSeed, NEAR_HALF, NEAR_HOLE, rockField, surfaceDetail, type SurfaceDetail } from './nearDetail';
import v from './moonview.module.css';

/** Sky objects are built on this sphere (metres) inside a dome scaled by SKY_SCALE (≈ 3,200 km). */
const SKY_R = 8000;
/** The dome is scaled up so it sits beyond the Moon's horizon even from 15 km up. */
const SKY_SCALE = 400;
const EYE_HEIGHT = 1.8;
const FOV = 60;
/** Fly above: altitude (m), horizontal stand-off per metre of altitude, and look-down angle. */
const ABOVE_ALT = 15_000;
const ABOVE_BACK = 1.3;
const ABOVE_PITCH_DEG = -22;
/** Seconds for the climb (and for the way back down). */
const FLY_S = 2.2;

export interface BodyLabel {
  /** e.g. "Sets in 14d 6h" — computed by the page from the day report. */
  next: string | null;
}

export interface MoonView3DProps {
  sky?: SkyState;
  /** Where we stand: puts the real Moon globe under the site and names the "you are here" pin. */
  site?: { lat: number; lon: number; name: string };
  /** Time-ordered sky samples over the lunar day (DayReport.samples) for the dotted paths. */
  samples?: SkyState[];
  terrain: TerrainSource;
  /** Real horizon profile: draws the distant skyline beyond the terrain patch (stand mode). */
  horizon?: HorizonProfile;
  mode: 'stand' | 'above';
  sunLabel?: BodyLabel;
  earthLabel?: BodyLabel;
  /** Compact chrome for side-by-side use. */
  dense?: boolean;
}

// ---------------------------------------------------------------- textures

/** Soft radial glow sprite. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.15, 'rgba(255,244,214,0.35)');
  grd.addColorStop(1, 'rgba(255,244,214,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** PLACEHOLDER Earth map (oceans, land, clouds) until a NASA Blue Marble texture is added. */
function placeholderEarthTexture() {
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1f4f8f';
  g.fillRect(0, 0, w, h);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 26; i++) {
    g.fillStyle = rnd() > 0.5 ? '#4f7a3a' : '#8a7a55';
    g.beginPath();
    g.ellipse(rnd() * w, h * 0.2 + rnd() * h * 0.6, 20 + rnd() * 60, 12 + rnd() * 40, rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 70; i++) {
    g.beginPath();
    g.ellipse(rnd() * w, rnd() * h, 10 + rnd() * 40, 3 + rnd() * 8, rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(0, 0, w, 14);
  g.fillRect(0, h - 14, w, 14);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * COSMETIC surface detail (Hagras): small craters, pebbles and grain as a BUMP texture, tiled every
 * DETAIL_TILE_M metres. It only changes shading — never heights, the skyline, or any number — so the
 * 10–20 m NASA terrain reads like real regolith up close. Seeded, so it looks the same every time.
 */
const DETAIL_TILE_M = 160;
function regolithDetail() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, size, size);
  let s = 90210;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  // Fine grain.
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rnd() - 0.5) * 34;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
  // Craters (dark bowl + bright raised rim), many small, few large; drawn wrapped so tiles join.
  const crater = (x: number, y: number, r: number) => {
    for (const dx of [-size, 0, size])
      for (const dy of [-size, 0, size]) {
        const cx = x + dx;
        const cy = y + dy;
        if (cx + r * 1.4 < 0 || cy + r * 1.4 < 0 || cx - r * 1.4 > size || cy - r * 1.4 > size) continue;
        const bowl = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        bowl.addColorStop(0, 'rgba(40,40,40,0.55)');
        bowl.addColorStop(0.85, 'rgba(90,90,90,0.25)');
        bowl.addColorStop(1, 'rgba(128,128,128,0)');
        g.fillStyle = bowl;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(205,205,205,0.45)';
        g.lineWidth = Math.max(1, r * 0.18);
        g.beginPath();
        g.arc(cx, cy, r * 1.02, 0, Math.PI * 2);
        g.stroke();
      }
  };
  for (let i = 0; i < 260; i++) crater(rnd() * size, rnd() * size, 1.5 + rnd() ** 3 * 9);
  for (let i = 0; i < 26; i++) crater(rnd() * size, rnd() * size, 10 + rnd() ** 2 * 34);
  // Pebbles: tiny bright specks.
  g.fillStyle = 'rgba(220,220,220,0.6)';
  for (let i = 0; i < 900; i++) g.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------- scene parts

const SEGMENTS = 512;

/**
 * TERRAIN SHADOWS (Hagras): instead of a shadow map (unreliable over a 12 km patch with a 1–5° Sun:
 * straight cut-offs, camera-dependent), every fragment walks across the real height field toward
 * the Sun. The highest terrain angle found, compared with the Sun's elevation and its 0.53° disc,
 * gives the fraction of the disc visible from that spot — the same rule the horizon files and the
 * cards use. Only the Sun's light is attenuated (matched by direction); earthshine and bounce are not.
 * Shadows from terrain BEYOND the patch are handled by the light's global visibleFraction.
 */
const SHADOW_GLSL = /* glsl */ `
uniform sampler2D uHeight;
uniform float uRadius;
uniform float uTexN;
uniform vec3 uSunWorld;
uniform vec3 uSunView;
varying vec3 vTerrainPos;
float terrainHeight(vec2 xz) {
  vec2 uv = (xz + uRadius) / (2.0 * uRadius);
  uv = (uv * (uTexN - 1.0) + 0.5) / uTexN;
  return texture2D(uHeight, uv).r;
}
float sunShadow(vec3 lightDirView) {
  if (dot(lightDirView, uSunView) < 0.9999) return 1.0; // not the Sun
  vec3 s = normalize(uSunWorld);
  float horiz = length(s.xz);
  if (horiz < 1e-4) return 1.0;
  vec2 dir = s.xz / horiz;
  float el = atan(s.y, horiz);
  float worst = -1.0; // highest (terrain angle − Sun elevation), radians
  float t = 20.0;
  for (int i = 0; i < 110; i++) {
    vec2 p = vTerrainPos.xz + dir * t;
    if (abs(p.x) > uRadius || abs(p.y) > uRadius) break;
    // Tested from 2 m above the ground (a lander's panels), like the horizon files and the cards:
    // big terrain shadows are unchanged, and the view never contradicts "sunlit" on the cards.
    float a = atan(terrainHeight(p) - vTerrainPos.y - 2.0, t);
    worst = max(worst, a - el);
    t = t * 1.045 + 6.0;
  }
  // Sun disc radius 0.265° = 0.004625 rad: visible fraction of the disc (linearised).
  return clamp(0.5 - 0.5 * worst / 0.004625, 0.0, 1.0);
}
`;

type ShadowUniforms = Record<'uHeight' | 'uRadius' | 'uTexN' | 'uSunWorld' | 'uSunView', THREE.IUniform>;

/**
 * A regolith material with Hagras's ray-marched terrain shadows (factored out by Aser so the near
 * detail patch and the rocks share them). `hole`: hide this surface inside |x|,|z| < hole (the coarse
 * mesh under the detailed patch). `instanced`: for InstancedMesh (rocks).
 */
function shadowedMaterial(params: THREE.MeshStandardMaterialParameters, uniforms: ShadowUniforms, opts: { key: string; hole?: number; instanced?: boolean }) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uHole: { value: opts.hole ?? 0 } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainPos;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>\nvTerrainPos = (modelMatrix * ${opts.instanced ? 'instanceMatrix * ' : ''}vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uHole;\n${SHADOW_GLSL}`)
      .replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\n\tif (uHole > 0.0 && max(abs(vTerrainPos.x), abs(vTerrainPos.z)) < uHole) discard;',
      )
      .replace(
        '#include <lights_fragment_begin>',
        THREE.ShaderChunk.lights_fragment_begin.replace(
          /RE_Direct\( directLight, geometryPosition/g,
          'directLight.color *= sunShadow( directLight.direction );\n\t\tRE_Direct( directLight, geometryPosition',
        ),
      );
  };
  m.customProgramCacheKey = () => `terrain-raymarch-shadow-v2-${opts.key}`;
  return m;
}

function Terrain({ terrain, sky, seed }: { terrain: TerrainSource; sky?: SkyState; seed: number }) {
  // Aser: detail finer than the NASA grid, only near the observer (nearDetail.ts).
  const surface = useMemo(() => surfaceDetail(seed, !terrain.placeholder), [seed, terrain.placeholder]);
  const { geometry, heightTex } = useMemo(() => {
    const size = terrain.radius * 2;
    // 512 cells: ~23 m apart over the 12 km real-terrain patch (data is 20 m).
    const g = new THREE.PlaneGeometry(size, size, SEGMENTS, SEGMENTS);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    // Round patch whose outer rim fades out, so from above it melts into the globe below.
    const rgba = new Float32Array(p.count * 4);
    // Same heights as the mesh, for the shadow ray-march (row 0 = north edge, like the mesh).
    const halves = new Uint16Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const h = terrain.heightAt(p.getX(i), p.getZ(i));
      p.setY(i, h);
      halves[i] = THREE.DataUtils.toHalfFloat(h);
      const d = Math.hypot(p.getX(i), p.getZ(i)) / terrain.radius;
      const a = surface.albedoAt(p.getX(i), p.getZ(i), false);
      rgba.set([a, a, a, 1 - THREE.MathUtils.smoothstep(d, 0.82, 0.99)], i * 4);
    }
    g.setAttribute('color', new THREE.BufferAttribute(rgba, 4));
    g.computeVertexNormals();
    const tex = new THREE.DataTexture(halves, SEGMENTS + 1, SEGMENTS + 1, THREE.RedFormat, THREE.HalfFloatType);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return { geometry: g, heightTex: tex };
  }, [terrain, surface]);

  // Aser: the detailed patch around the observer, a point every 1 m. Real ground + small craters,
  // bumps and brightness patches; near its edge it blends into the coarse mesh's own (interpolated)
  // heights so there is no step where they meet.
  const near = useMemo(() => {
    const cell = (terrain.radius * 2) / SEGMENTS;
    const coarseAt = (x: number, z: number) => {
      const fx = (x + terrain.radius) / cell;
      const fz = (z + terrain.radius) / cell;
      const ix = Math.floor(fx);
      const iz = Math.floor(fz);
      const tx = fx - ix;
      const tz = fz - iz;
      const at = (i: number, j: number) => terrain.heightAt(i * cell - terrain.radius, j * cell - terrain.radius);
      const top = at(ix, iz) * (1 - tx) + at(ix + 1, iz) * tx;
      const bot = at(ix, iz + 1) * (1 - tx) + at(ix + 1, iz + 1) * tx;
      return top * (1 - tz) + bot * tz;
    };
    const n = NEAR_HALF * 2;
    const g = new THREE.PlaneGeometry(n, n, n, n);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    const rgba = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const edge = THREE.MathUtils.smoothstep(Math.max(Math.abs(x), Math.abs(z)), NEAR_HOLE - 35, NEAR_HOLE);
      const fine = terrain.heightAt(x, z) + surface.heightAt(x, z);
      p.setY(i, edge > 0 ? fine * (1 - edge) + coarseAt(x, z) * edge : fine);
      const a = surface.albedoAt(x, z, true);
      rgba.set([a, a, a, 1], i * 4);
    }
    g.setAttribute('color', new THREE.BufferAttribute(rgba, 4));
    g.computeVertexNormals();
    return g;
  }, [terrain, surface]);
  useEffect(() => () => near.dispose(), [near]);
  useEffect(
    () => () => {
      geometry.dispose();
      heightTex.dispose();
    },
    [geometry, heightTex],
  );

  const detail = useMemo(() => {
    const t = regolithDetail();
    const reps = (terrain.radius * 2) / DETAIL_TILE_M;
    t.repeat.set(reps, reps);
    return t;
  }, [terrain]);
  useEffect(() => () => detail.dispose(), [detail]);

  const uniforms = useMemo(
    () => ({
      uHeight: { value: heightTex },
      uRadius: { value: terrain.radius },
      uTexN: { value: SEGMENTS + 1 },
      uSunWorld: { value: new THREE.Vector3(1, 0.05, 0) },
      uSunView: { value: new THREE.Vector3(1, 0, 0) },
    }),
    [heightTex, terrain.radius],
  );

  // The same bump texture on the patch, offset so its tiles line up with the coarse mesh's.
  const nearDetailTex = useMemo(() => {
    const t = detail.clone();
    t.repeat.set((NEAR_HALF * 2) / DETAIL_TILE_M, (NEAR_HALF * 2) / DETAIL_TILE_M);
    const off = ((terrain.radius - NEAR_HALF) / DETAIL_TILE_M) % 1;
    t.offset.set(off, off);
    t.needsUpdate = true;
    return t;
  }, [detail, terrain.radius]);
  useEffect(() => () => nearDetailTex.dispose(), [nearDetailTex]);

  const { material, nearMaterial } = useMemo(() => {
    // Regolith: grey, fully rough, no gloss (airless). Bump = cosmetic small-scale detail only.
    const base = { color: new THREE.Color(0.55, 0.54, 0.52), roughness: 1, metalness: 0, vertexColors: true, bumpScale: 2.2 };
    return {
      // The coarse mesh, hidden under the detailed patch.
      material: shadowedMaterial({ ...base, transparent: true, bumpMap: detail }, uniforms, { key: 'coarse', hole: NEAR_HOLE }),
      // Drawn in front where the two overlap (the last metres of the patch), so no flicker.
      nearMaterial: shadowedMaterial({ ...base, bumpMap: nearDetailTex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, uniforms, { key: 'near' }),
    };
  }, [detail, nearDetailTex, uniforms]);
  useEffect(
    () => () => {
      material.dispose();
      nearMaterial.dispose();
    },
    [material, nearMaterial],
  );

  // Keep the Sun direction current (world for the march, view for matching the light).
  const sunWorld = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const d = sky ? azElToLocal(sky.sun.azDeg, sky.sun.elDeg) : ([1, 0.05, 0] as Vec3Tuple);
    sunWorld.set(d[0], d[1], d[2]).normalize();
    uniforms.uSunWorld.value.copy(sunWorld);
    uniforms.uSunView.value.copy(sunWorld).transformDirection(camera.matrixWorldInverse);
  });

  return (
    <>
      <mesh geometry={geometry} material={material} />
      <mesh geometry={near} material={nearMaterial} />
      <Rocks terrain={terrain} surface={surface} seed={seed} uniforms={uniforms} />
    </>
  );
}

/**
 * Rocks and boulders near the observer (Aser). Procedural (no models): squashed, jittered
 * icosahedra, many small and few large, all under 1.1 m (below the 1.8 m eye), so they can never hide
 * the Sun or Earth. They sit on the detailed ground and get the same terrain shadows.
 */
function Rocks({ terrain, surface, seed, uniforms }: { terrain: TerrainSource; surface: SurfaceDetail; seed: number; uniforms: ShadowUniforms }) {
  const rocks = useMemo(() => rockField(seed), [seed]);
  const geometry = useMemo(() => {
    let s = seed * 31 + 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const f = 0.75 + rnd() * 0.45;
      p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.7, p.getZ(i) * f);
    }
    geo.computeVertexNormals();
    return geo;
  }, [seed]);
  const material = useMemo(
    () => shadowedMaterial({ color: new THREE.Color(0.47, 0.46, 0.44), roughness: 1, metalness: 0, flatShading: true }, uniforms, { key: 'rocks', instanced: true }),
    [uniforms],
  );
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    rocks.forEach((r, i) => {
      e.set(r.rot[0], r.rot[1], r.rot[2]);
      q.setFromEuler(e);
      pos.set(r.x, terrain.heightAt(r.x, r.z) + surface.heightAt(r.x, r.z) + r.size * 0.25, r.z);
      scl.set(r.size, r.size * r.squash[0], r.size * r.squash[1]);
      mesh.setMatrixAt(i, m.compose(pos, q, scl));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [rocks, terrain, surface]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <instancedMesh ref={ref} args={[geometry, material, rocks.length]} />;
}

/**
 * Distant skyline beyond the terrain patch (Hagras): a ring just outside the patch whose top edge
 * sits at the horizon profile's elevation for every azimuth (720 values, real LOLA / SLDEM terrain
 * out to 310 km). The visible skyline is then the higher of the near mesh and this ring, exactly
 * the horizon the cards use, so the view never shows the Sun while a card says "hidden".
 */
function HorizonRing({ horizon, terrain }: { horizon: HorizonProfile; terrain: TerrainSource }) {
  const geometry = useMemo(() => {
    const eye = terrain.heightAt(0, 0) + EYE_HEIGHT;
    const d = terrain.radius * 1.04;
    const n = horizon.elevationsDeg.length;
    const pos = new Float32Array((n + 1) * 2 * 3);
    for (let i = 0; i <= n; i++) {
      const az = (i % n) * horizon.azStepDeg;
      const [x, , z] = azElToLocal(az, 0, d);
      const top = eye + d * Math.tan((horizon.elevationsDeg[i % n] * Math.PI) / 180);
      const bottom = Math.min(top, eye) - 600; // well below the ground and the globe at that distance
      pos.set([x, bottom, z, x, top, z], i * 6);
    }
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [horizon, terrain]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={new THREE.Color(0.4, 0.39, 0.38)} roughness={1} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Stars() {
  const positions = useMemo(() => {
    const n = 1600;
    const p = new Float32Array(n * 3);
    let s = 1247;
    const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < n; i++) {
      const az = r() * Math.PI * 2;
      const y = r() * 1.05 - 0.05; // mostly above the horizon
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      p.set([Math.cos(az) * ring * 9500, y * 9500, Math.sin(az) * ring * 9500], i * 3);
    }
    return p;
  }, []);
  return (
    <points renderOrder={-10}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color.text} size={1.4} sizeAttenuation={false} depthWrite={false} transparent opacity={0.85} />
    </points>
  );
}

/** Light from the Sun's direction (long low-Sun shadows) plus a faint earthshine fill. */
function Lighting({ sky, radius }: { sky?: SkyState; radius: number }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.add(target);
    return () => {
      scene.remove(target);
    };
  }, [scene, target]);
  const dir = sky ? azElToLocal(sky.sun.azDeg, sky.sun.elDeg, radius * 1.5) : ([1, 0.05, 0] as Vec3Tuple);
  // Lit only as much as the Sun's disc clears the REAL skyline (same rule as the cards).
  const lit = sky ? (sky.sun.visibleFraction ?? (sky.sunVisible ? 1 : 0)) : 0;
  const up = lit > 0;
  const earth = sky ? azElToLocal(sky.earth.azDeg, sky.earth.elDeg) : ([0, 0.1, -1] as Vec3Tuple);
  return (
    <>
      <directionalLight
        ref={sun}
        position={dir}
        target={target}
        // Exposure: bright for the pole's grazing light, toned down as the Sun climbs (no blow-out).
        intensity={up ? (3.2 * lit) / (1 + 3 * Math.sin((Math.max(0, sky?.sun.elDeg ?? 0) * Math.PI) / 180)) : 0}
        castShadow={false}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-radius}
        shadow-camera-right={radius}
        shadow-camera-top={radius}
        shadow-camera-bottom={-radius}
        shadow-camera-near={1}
        shadow-camera-far={radius * 4}
        shadow-bias={-0.0004}
      />
      {/* Earthshine: faint blue-white light from Earth's direction; shadows are dark, not black. */}
      <directionalLight position={earth.map((x) => x * 100) as Vec3Tuple} intensity={sky?.earthVisible ? 0.18 : 0.05} color={color.earth} />
      {/* Bounce light: sunlit regolith lights the shadows a little (no air, so still very dark).
          Comes from the side opposite the Sun, low; scales with how much Sun there is. */}
      <directionalLight position={[-dir[0], radius * 0.4, -dir[2]]} intensity={0.22 * lit} color={new THREE.Color(0.85, 0.82, 0.78)} />
      <ambientLight intensity={0.07 + 0.06 * lit} />
    </>
  );
}

function Bodies({ sky }: { sky?: SkyState }) {
  const glow = useMemo(glowTexture, []);
  const earthMap = useMemo(placeholderEarthTexture, []);
  if (!sky) return null;
  const sunPos = azElToLocal(sky.sun.azDeg, sky.sun.elDeg, SKY_R);
  const earthPos = azElToLocal(sky.earth.azDeg, sky.earth.elDeg, SKY_R);
  const sunR = SKY_R * Math.tan(((sky.sun.angularDiameterDeg || 0.53) * Math.PI) / 360);
  const earthR = SKY_R * Math.tan(((sky.earth.angularDiameterDeg || 1.9) * Math.PI) / 360);
  return (
    <>
      <group position={sunPos}>
        <mesh>
          <sphereGeometry args={[sunR, 32, 16]} />
          <meshBasicMaterial color={color.text} toneMapped={false} depthWrite={false} />
        </mesh>
        {/* Glare in the eye/camera only — there is no air to scatter light. */}
        <sprite scale={[sunR * 14, sunR * 14, 1]}>
          <spriteMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      </group>
      {/* Lit by the same Sun direction as the terrain, so its phase is right by construction. */}
      <mesh position={earthPos} rotation={[0.41, 0, 0]}>
        <sphereGeometry args={[earthR, 48, 32]} />
        <meshStandardMaterial map={earthMap} roughness={0.9} metalness={0} depthWrite={false} />
      </mesh>
    </>
  );
}

function SkyPaths({ samples }: { samples?: SkyState[] }) {
  const sun = useMemo(() => (samples ? skyPathSegments(samples.map((s) => s.sun), SKY_R * 0.99) : []), [samples]);
  const earth = useMemo(() => (samples ? skyPathSegments(samples.map((s) => s.earth), SKY_R * 0.99) : []), [samples]);
  const horizon = useMemo(() => Array.from({ length: 181 }, (_, i) => azElToLocal(i * 2, 0, SKY_R * 0.98)), []);
  return (
    <>
      {sun.map((pts, i) => (
        <Line key={`s${i}`} points={pts} color={color.sun} lineWidth={1.4} dashed dashSize={40} gapSize={60} transparent opacity={0.75} />
      ))}
      {earth.map((pts, i) => (
        <Line key={`e${i}`} points={pts} color={color.earth} lineWidth={1.4} dashed dashSize={40} gapSize={60} transparent opacity={0.75} />
      ))}
      <Line points={horizon} color={color.text} lineWidth={1} dashed dashSize={30} gapSize={90} transparent opacity={0.25} />
    </>
  );
}

/** Stars, Sun, Earth and paths: centred on the camera and scaled far out, so the ground (terrain
 *  and globe) always hides what is below the horizon, whatever the altitude. */
function SkyDome({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ camera }) => g.current?.position.copy(camera.position));
  return (
    <group ref={g} scale={SKY_SCALE}>
      {children}
    </group>
  );
}

/** Local (x east, y up, z south) direction → Moon-fixed frame at the site. */
function localToMoon(d: Vec3Tuple, lat: number, lon: number): Vec3 {
  const { east, north, up } = enuAxes(lat, lon);
  return {
    x: east.x * d[0] + up.x * d[1] - north.x * d[2],
    y: east.y * d[0] + up.y * d[1] - north.y * d[2],
    z: east.z * d[0] + up.z * d[1] - north.z * d[2],
  };
}

/** The real Moon (Moon Trek imagery, true radius) laid under the site: site at the origin, its
 *  local up = +Y, east = +X, north = −Z. MoonTrekGlobe is 1 unit = 1 radius, so scale it back to metres. */
function GlobeUnderSite({ lat, lon, sky, topY = 0 }: { lat: number; lon: number; sky?: SkyState; topY?: number }) {
  const quaternion = useMemo(() => {
    const { east, north, up } = enuAxes(lat, lon);
    // Moon-fixed → local rows (east, up, −north), after undoing the globe's own Z-up → Y-up turn.
    const toLocal = new THREE.Matrix4().set(east.x, east.y, east.z, 0, up.x, up.y, up.z, 0, -north.x, -north.y, -north.z, 0, 0, 0, 0, 1);
    const undoBody = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).invert();
    return new THREE.Quaternion().setFromRotationMatrix(toLocal.multiply(undoBody));
  }, [lat, lon]);
  const sun = useMemo(() => (sky ? localToMoon(azElToLocal(sky.sun.azDeg, sky.sun.elDeg), lat, lon) : DEFAULT_SUN), [sky, lat, lon]);
  return (
    // Its top sits at `topY`: just below the lowest real ground, so the smooth sphere never covers the
    // terrain (sites on summits and rims have ground far below them).
    <group position={[0, -MOON_RADIUS_M + topY, 0]} quaternion={quaternion} scale={MOON_RADIUS_M}>
      <MoonTrekGlobe sun={sun} />
    </group>
  );
}

// ---------------------------------------------------------------- camera

interface Look {
  yaw: number; // radians, 0 = north, clockwise like azimuth
  pitch: number; // radians
}

const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

/**
 * Stand: eye height on the site, looking where you dragged. Above: 15 km up, set back along the view
 * direction, looking down 22° (the site below, the curved horizon at the top). Switching flies
 * between them: the altitude grows geometrically (slow lift-off, then a fast climb), so it feels
 * like taking off rather than a zoom.
 */
function CameraRig({ look, mode, terrain }: { look: MutableRefObject<Look>; mode: 'stand' | 'above'; terrain: TerrainSource }) {
  const camera = useThree((s) => s.camera);
  const eye = useMemo(() => terrain.heightAt(0, 0) + EYE_HEIGHT, [terrain]);
  const k = useRef(mode === 'above' ? 1 : 0);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(), []);
  const t = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const goal = mode === 'above' ? 1 : 0;
    const step = Math.min(dt, 0.05) / FLY_S;
    k.current = goal > k.current ? Math.min(goal, k.current + step) : Math.max(goal, k.current - step);
    const e = ease(k.current);
    const { yaw, pitch } = look.current;
    const yawDeg = (yaw * 180) / Math.PI;

    const h = EYE_HEIGHT * (ABOVE_ALT / EYE_HEIGHT) ** e; // 1.8 m … 15 km, geometric
    const back = azElToLocal(yawDeg + 180, 0, (h - EYE_HEIGHT) * ABOVE_BACK);
    camera.position.set(back[0], eye - EYE_HEIGHT + h, back[2]);

    dir.set(...azElToLocal(yawDeg, (pitch * 180) / Math.PI));
    up.set(...azElToLocal(yawDeg, ABOVE_PITCH_DEG));
    dir.lerp(up, e).normalize();
    camera.lookAt(t.copy(camera.position).add(dir));
  });
  return null;
}

interface Anchor {
  id: string;
  pos: Vec3Tuple;
  /** In the sky dome (follows the camera) rather than on the ground. */
  sky?: boolean;
}

/** Projects 3D points to the canvas and moves DOM labels there (like the Step 1 pins). */
function LabelProjector({ anchors, els }: { anchors: Anchor[]; els: MutableRefObject<Map<string, HTMLElement>> }) {
  const p = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const a of anchors) {
      const el = els.current.get(a.id);
      if (!el) continue;
      p.set(...a.pos);
      if (a.sky) p.multiplyScalar(SKY_SCALE).add(camera.position); // lives in the sky dome
      p.project(camera);
      const hidden = String(p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2);
      if (el.dataset.hidden !== hidden) el.dataset.hidden = hidden;
      el.style.transform = `translate3d(${((p.x + 1) / 2) * size.width}px, ${((1 - p.y) / 2) * size.height}px, 0)`;
    }
  });
  return null;
}

// ---------------------------------------------------------------- component

export default function MoonView3D({ sky, site, samples, terrain, horizon, mode, sunLabel, earthLabel, dense }: MoonView3DProps) {
  // Open looking toward the Sun (or Earth if the Sun is down), slightly above the horizon.
  const initialYaw = sky ? ((sky.sunVisible || !sky.earthVisible ? sky.sun.azDeg : sky.earth.azDeg) * Math.PI) / 180 : 0;
  const look = useRef<Look>({ yaw: initialYaw, pitch: (4 * Math.PI) / 180 });
  const aimed = useRef(Boolean(sky));
  useEffect(() => {
    if (aimed.current || !sky) return;
    aimed.current = true;
    look.current.yaw = ((sky.sunVisible || !sky.earthVisible ? sky.sun.azDeg : sky.earth.azDeg) * Math.PI) / 180;
  }, [sky]);

  // Drag to look around (horizontal = turn, vertical = tilt). Non-inverted.
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY };
    setGrabbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const w = e.currentTarget.clientWidth || 1;
    const radPerPx = ((FOV * (w / (e.currentTarget.clientHeight || 1))) * Math.PI) / 180 / w;
    look.current.yaw -= (e.clientX - drag.current.x) * radPerPx;
    look.current.pitch = THREE.MathUtils.clamp(look.current.pitch + (e.clientY - drag.current.y) * radPerPx, -0.5, 1.2);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => {
    drag.current = null;
    setGrabbing(false);
  };

  const els = useRef(new Map<string, HTMLElement>());
  const bind = (id: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };
  const siteY = useMemo(() => terrain.heightAt(0, 0), [terrain]);
  // Lowest ground in the patch (coarse scan), so the globe can sit just below it.
  const globeTop = useMemo(() => {
    let min = Infinity;
    const R = terrain.radius;
    for (let i = 0; i <= 96; i++)
      for (let j = 0; j <= 96; j++) {
        const x = -R + (2 * R * i) / 96;
        const z = -R + (2 * R * j) / 96;
        if (x * x + z * z <= R * R) min = Math.min(min, terrain.heightAt(x, z));
      }
    return Math.min(0, min) - 40;
  }, [terrain]);
  const anchors = useMemo(() => {
    const a: Anchor[] = [];
    if (sky) {
      a.push({ id: 'sun', pos: azElToLocal(sky.sun.azDeg, sky.sun.elDeg, SKY_R), sky: true });
      a.push({ id: 'earth', pos: azElToLocal(sky.earth.azDeg, sky.earth.elDeg, SKY_R), sky: true });
    }
    for (const [id, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as const) a.push({ id, pos: azElToLocal(az, 0, SKY_R * 0.98), sky: true });
    a.push({ id: 'site', pos: [0, siteY, 0] });
    return a;
  }, [sky, siteY]);

  return (
    <div
      className={[v.view, grabbing && v.grabbing, dense && v.dense].filter(Boolean).join(' ')}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="img"
      aria-label={
        sky
          ? `View from the site. Sun ${formatDeg(sky.sun.elDeg, 1)} ${sky.sunVisible ? 'visible' : 'hidden'}; Earth ${formatDeg(sky.earth.elDeg, 1)} ${sky.earthVisible ? 'visible' : 'hidden'}. Drag to look around.`
          : 'View from the site, loading.'
      }
    >
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: FOV, near: 0.5, far: SKY_R * SKY_SCALE * 1.2, position: [0, 2, 0] }}
        gl={{ antialias: true, logarithmicDepthBuffer: true }}
      >
        <color attach="background" args={[color.bg]} />
        <SkyDome>
          <Stars />
          <Bodies sky={sky} />
          <SkyPaths samples={samples} />
        </SkyDome>
        <Lighting sky={sky} radius={terrain.radius} />
        {site && <GlobeUnderSite lat={site.lat} lon={site.lon} sky={sky} topY={globeTop} />}
        <Terrain terrain={terrain} sky={sky} seed={detailSeed(site?.lat, site?.lon)} />
        {horizon && mode === 'stand' && <HorizonRing horizon={horizon} terrain={terrain} />}
        <CameraRig look={look} mode={mode} terrain={terrain} />
        <LabelProjector anchors={anchors} els={els} />
      </Canvas>

      <div className={v.labels} aria-hidden>
        {sky && (
          <>
            <div ref={bind('sun')} className={v.anchor} data-hidden="true">
              <span className={[v.tag, v.tagSun].join(' ')}>
                <b>Sun</b>
                <span className="num">{formatDeg(sky.sun.elDeg, 1)}</span>
                {sunLabel?.next && <small>{sunLabel.next}</small>}
                {!sky.sunVisible && <small>behind terrain</small>}
              </span>
            </div>
            <div ref={bind('earth')} className={v.anchor} data-hidden="true">
              <span className={[v.tag, v.tagEarth].join(' ')}>
                <b>Earth</b>
                <span className="num">{formatDeg(sky.earth.elDeg, 1)}</span>
                {earthLabel?.next && <small>{earthLabel.next}</small>}
                {!sky.earthVisible && <small>behind terrain</small>}
              </span>
            </div>
          </>
        )}
        {site && (
          <div ref={bind('site')} className={[v.anchor, mode === 'above' ? v.siteOn : v.siteOff].join(' ')} data-hidden="true">
            <span className={v.sitePin}>
              <i aria-hidden />
              You are here · {site.name}
            </span>
          </div>
        )}
        {['N', 'E', 'S', 'W'].map((d) => (
          <div key={d} ref={bind(d)} className={v.anchor} data-hidden="true">
            <span className={v.compass}>{d}</span>
          </div>
        ))}
      </div>

      {!dense && (
        <span className={v.hint}>
          <span aria-hidden>↔</span> Drag to look around
        </span>
      )}
      {/* Always say what the ground is: "Placeholder terrain" or "Real terrain · NASA LOLA 10 m". */}
      <span className={v.terrainNote}>{terrain.label}</span>
    </div>
  );
}
