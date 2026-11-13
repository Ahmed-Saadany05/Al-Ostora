/**
 * STAND ON SITE — the 3D Moon view (owner: Pink). Loaded lazily by SitePanorama.
 *
 * You stand on the site: terrain around you (TerrainSource — a placeholder until LOLA heights are
 * wired), black sky and stars, the Sun and Earth at their az/el from SkyState (real angular sizes,
 * Earth's phase from the Sun's direction), their dotted paths across the sky over the lunar day
 * (from DayReport samples), a dashed horizon and N/E/S/W marks. Labels over the Sun and Earth are
 * DOM elements that follow them. Drag to look around 360°; "above" orbits over the terrain.
 * Every number comes from props (the data hooks); nothing here invents values.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { formatDeg } from '@/shared/format';
import { color } from '@/shared/theme/tokens';
import type { SkyState } from '@/shared/types';
import { azElToLocal, skyPathSegments, type Vec3Tuple } from './skyMath';
import { type TerrainSource } from './terrain';
import v from './moonview.module.css';

/** Sky objects sit on this sphere (metres); far beyond the terrain, inside the camera's far plane. */
const SKY_R = 8000;
const EYE_HEIGHT = 1.8;
const FOV = 60;

export interface BodyLabel {
  /** e.g. "Sets in 14d 6h" — computed by the page from the day report. */
  next: string | null;
}

export interface MoonView3DProps {
  sky?: SkyState;
  /** Time-ordered sky samples over the lunar day (DayReport.samples) for the dotted paths. */
  samples?: SkyState[];
  terrain: TerrainSource;
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

// ---------------------------------------------------------------- scene parts

function Terrain({ terrain }: { terrain: TerrainSource }) {
  const geometry = useMemo(() => {
    const size = terrain.radius * 2;
    const g = new THREE.PlaneGeometry(size, size, 256, 256);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, terrain.heightAt(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    return g;
  }, [terrain]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      {/* Regolith: grey, fully rough, no gloss (airless). */}
      <meshStandardMaterial color={new THREE.Color(0.55, 0.54, 0.52)} roughness={1} metalness={0} />
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
  const up = sky ? sky.sun.elDeg > -0.3 : false;
  const earth = sky ? azElToLocal(sky.earth.azDeg, sky.earth.elDeg) : ([0, 0.1, -1] as Vec3Tuple);
  return (
    <>
      <directionalLight
        ref={sun}
        position={dir}
        target={target}
        intensity={up ? 3.2 : 0}
        castShadow
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
      <ambientLight intensity={0.07} />
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
          <meshBasicMaterial color={color.text} toneMapped={false} />
        </mesh>
        {/* Glare in the eye/camera only — there is no air to scatter light. */}
        <sprite scale={[sunR * 14, sunR * 14, 1]}>
          <spriteMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      </group>
      {/* Lit by the same Sun direction as the terrain, so its phase is right by construction. */}
      <mesh position={earthPos} rotation={[0.41, 0, 0]}>
        <sphereGeometry args={[earthR, 48, 32]} />
        <meshStandardMaterial map={earthMap} roughness={0.9} metalness={0} />
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

// ---------------------------------------------------------------- camera

interface Look {
  yaw: number; // radians, 0 = north, clockwise like azimuth
  pitch: number; // radians
}

function CameraRig({ look, mode, terrain }: { look: MutableRefObject<Look>; mode: 'stand' | 'above'; terrain: TerrainSource }) {
  const camera = useThree((s) => s.camera);
  const eye = useMemo(() => terrain.heightAt(0, 0) + EYE_HEIGHT, [terrain]);
  const t = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const { yaw, pitch } = look.current;
    if (mode === 'stand') {
      camera.position.set(0, eye, 0);
      const d = azElToLocal((yaw * 180) / Math.PI, (pitch * 180) / Math.PI);
      camera.lookAt(t.set(d[0], eye + d[1], d[2]));
    } else {
      // Fly above: orbit the site from 700 m up, 1.6 km out, looking at the observer's spot.
      const back = azElToLocal((yaw * 180) / Math.PI + 180, 24, 1700);
      camera.position.set(back[0], eye + back[1], back[2]);
      camera.lookAt(t.set(0, eye, 0));
    }
  });
  return null;
}

/** Projects 3D points to the canvas and moves DOM labels there (like the Step 1 pins). */
function LabelProjector({ anchors, els }: { anchors: { id: string; pos: Vec3Tuple }[]; els: MutableRefObject<Map<string, HTMLElement>> }) {
  const p = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const a of anchors) {
      const el = els.current.get(a.id);
      if (!el) continue;
      p.set(...a.pos).project(camera);
      const hidden = String(p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2);
      if (el.dataset.hidden !== hidden) el.dataset.hidden = hidden;
      el.style.transform = `translate3d(${((p.x + 1) / 2) * size.width}px, ${((1 - p.y) / 2) * size.height}px, 0)`;
    }
  });
  return null;
}

// ---------------------------------------------------------------- component

export default function MoonView3D({ sky, samples, terrain, mode, sunLabel, earthLabel, dense }: MoonView3DProps) {
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
  const anchors = useMemo(() => {
    const a: { id: string; pos: Vec3Tuple }[] = [];
    if (sky) {
      a.push({ id: 'sun', pos: azElToLocal(sky.sun.azDeg, sky.sun.elDeg, SKY_R) });
      a.push({ id: 'earth', pos: azElToLocal(sky.earth.azDeg, sky.earth.elDeg, SKY_R) });
    }
    for (const [id, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as const) a.push({ id, pos: azElToLocal(az, 0, SKY_R * 0.98) });
    return a;
  }, [sky]);

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
      <Canvas shadows dpr={[1, 1.75]} camera={{ fov: FOV, near: 0.5, far: 12000, position: [0, 2, 0] }} gl={{ antialias: true }}>
        <color attach="background" args={[color.bg]} />
        <Stars />
        <Lighting sky={sky} radius={terrain.radius} />
        <Terrain terrain={terrain} />
        <Bodies sky={sky} />
        <SkyPaths samples={samples} />
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
      {terrain.placeholder && <span className={v.terrainNote}>{terrain.label}</span>}
    </div>
  );
}
