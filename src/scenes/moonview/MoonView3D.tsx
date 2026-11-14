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
import type { SkyState } from '@/shared/types';
import { azElToLocal, skyPathSegments, type Vec3Tuple } from './skyMath';
import { type TerrainSource } from './terrain';
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
    // Round patch whose outer rim fades out, so from above it melts into the globe below.
    const rgba = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      p.setY(i, terrain.heightAt(p.getX(i), p.getZ(i)));
      const d = Math.hypot(p.getX(i), p.getZ(i)) / terrain.radius;
      rgba.set([1, 1, 1, 1 - THREE.MathUtils.smoothstep(d, 0.82, 0.99)], i * 4);
    }
    g.setAttribute('color', new THREE.BufferAttribute(rgba, 4));
    g.computeVertexNormals();
    return g;
  }, [terrain]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      {/* Regolith: grey, fully rough, no gloss (airless). */}
      <meshStandardMaterial color={new THREE.Color(0.55, 0.54, 0.52)} roughness={1} metalness={0} vertexColors transparent />
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
function GlobeUnderSite({ lat, lon, sky }: { lat: number; lon: number; sky?: SkyState }) {
  const quaternion = useMemo(() => {
    const { east, north, up } = enuAxes(lat, lon);
    // Moon-fixed → local rows (east, up, −north), after undoing the globe's own Z-up → Y-up turn.
    const toLocal = new THREE.Matrix4().set(east.x, east.y, east.z, 0, up.x, up.y, up.z, 0, -north.x, -north.y, -north.z, 0, 0, 0, 0, 1);
    const undoBody = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).invert();
    return new THREE.Quaternion().setFromRotationMatrix(toLocal.multiply(undoBody));
  }, [lat, lon]);
  const sun = useMemo(() => (sky ? localToMoon(azElToLocal(sky.sun.azDeg, sky.sun.elDeg), lat, lon) : DEFAULT_SUN), [sky, lat, lon]);
  return (
    <group position={[0, -MOON_RADIUS_M, 0]} quaternion={quaternion} scale={MOON_RADIUS_M}>
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

export default function MoonView3D({ sky, site, samples, terrain, mode, sunLabel, earthLabel, dense }: MoonView3DProps) {
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
        {site && <GlobeUnderSite lat={site.lat} lon={site.lon} sky={sky} />}
        <Terrain terrain={terrain} />
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
      {terrain.placeholder && <span className={v.terrainNote}>{terrain.label}</span>}
    </div>
  );
}
