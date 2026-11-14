/**
 * MISSION SUMMARY MOON — the real Moon (NASA Moon Trek imagery) you can spin (owner: Pink).
 * Loaded lazily by MissionGlobe.
 *
 * The landing site starts facing you. Drag to spin the Moon (with a little momentum). Earth hangs
 * in the sky top-left; when Earth is in sight from the site, a dotted radio beam runs from Earth to
 * the site (always drawn over the Moon), and the white site pin and its name ride on the surface:
 * both follow the Moon as it turns; the pin hides when the site turns away. Gold-lit when the Sun is up at touchdown,
 * dimmed when not (the same rules as the flat picture it replaces).
 */
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Suspense, useMemo, useRef, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { color } from '@/shared/theme/tokens';
import { MoonTrekGlobe } from '../globe/MoonTrekGlobe';
import { createMoonLight } from '../globe/moonShading';
import { latLonToVec } from '../lib/moonFrame';
import g from './missionGlobe.module.css';

export interface MissionGlobe3DProps {
  /** Called once, when the Moon's imagery has loaded (the page then fades from the flat picture). */
  onReady?: () => void;
  lat: number;
  lon: number;
  siteName: string;
  /** Sun up at touchdown: full light. Otherwise dimmed. */
  sunlit: boolean;
  /** Earth in sight from the site: beam drawn, Earth bright. Otherwise Earth faded, no beam. */
  contact: boolean;
}

/** Moon centre and Earth placement in the scene (1 unit = 1 lunar radius), as in the flat picture. */
const MOON_AT = new THREE.Vector3(0.12, -0.1, 0);
const EARTH_AT = new THREE.Vector3(-1.08, 0.98, 0.5);
const EARTH_R = 0.17;
/** Spin per pixel dragged (radians), and how fast the momentum dies (per second). */
const SPIN_PER_PX = 0.008;
const SPIN_DAMPING = 3.2;
/**
 * Speed of the beam's dashes along the line (scene units / s). The beam's end travels over the
 * Moon's surface toward the site at this same speed after a spin.
 */
const BEAM_SPEED = 0.35;
/** Dashes (not dots): segment and gap lengths along the beam, scene units. */
const BEAM_DASH = 0.1;
const BEAM_GAP = 0.065;

/** Moon-fixed lat/lon → the globe's scene frame (x = 0° lon, y = north, z = 90° W). */
const toScene = (lat: number, lon: number, r = 1) => {
  const v = latLonToVec(lat, lon, r);
  return new THREE.Vector3(v.x, v.z, -v.y);
};

/** Turn the Moon so the site faces the camera (+Z) with north kept up. */
function facingSite(lat: number, lon: number) {
  const d = toScene(lat, lon);
  const yaw = Math.atan2(d.x, d.z);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
  // After the yaw the site is in the y–z plane; tip it forward by its latitude.
  return q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (lat * Math.PI) / 180));
}

interface Spin {
  dragging: boolean;
  vx: number; // radians / s about world Y
  vy: number; // radians / s about world X
}

function Earth({ contact }: { contact: boolean }) {
  const map = useLoader(THREE.TextureLoader, '/earth/earth_atmos_2048.jpg');
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
  }, [map]);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (mesh.current) mesh.current.rotation.y += dt * 0.08;
  });
  return (
    <group position={EARTH_AT} rotation={[0, 0, THREE.MathUtils.degToRad(23.4)]}>
      <mesh ref={mesh}>
        <sphereGeometry args={[EARTH_R, 48, 32]} />
        <meshStandardMaterial map={map} roughness={0.75} emissive={color.earth} emissiveIntensity={0.06} transparent opacity={contact ? 1 : 0.35} />
      </mesh>
      <mesh scale={1.06}>
        <sphereGeometry args={[EARTH_R, 32, 24]} />
        <meshBasicMaterial color={color.earth} transparent opacity={contact ? 0.12 : 0.04} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Scene({
  lat,
  lon,
  sunlit,
  contact,
  onReady,
  spin,
  pinEl,
  moon,
}: MissionGlobe3DProps & { spin: MutableRefObject<Spin>; pinEl: MutableRefObject<HTMLDivElement | null>; moon: MutableRefObject<THREE.Group | null> }) {
  const camera = useThree((s) => s.camera);
  const start = useMemo(() => facingSite(lat, lon), [lat, lon]);
  const siteLocal = useMemo(() => toScene(lat, lon, 1.004), [lat, lon]);
  const light = useMemo(() => {
    const l = createMoonLight();
    // From the upper left, a little in front: the near side reads as lit.
    l.uSun.value.set(-0.45, 0.35, 1).normalize();
    return l;
  }, []);
  useMemo(() => {
    light.uExposure.value = sunlit ? 1.2 : 0.5;
    light.uNightFloor.value = sunlit ? 0.04 : 0.25;
  }, [light, sunlit]);

  type BeamLine = {
    geometry: { setPositions: (p: number[]) => void };
    computeLineDistances: () => void;
    renderOrder: number;
    material: { dashOffset: number; depthTest: boolean; depthWrite: boolean };
  };
  const beam = useRef<BeamLine | null>(null);
  const beamShade = useRef<BeamLine | null>(null);
  const tmp = useMemo(() => ({ site: new THREE.Vector3(), normal: new THREE.Vector3(), toCam: new THREE.Vector3(), q: new THREE.Quaternion(), ax: new THREE.Vector3() }), []);
  // Where the beam ends: travels toward the site over the Moon's surface (direction from the centre)
  // at the dashes' own speed, so after a spin it glides back onto the landing site.
  const beamDir = useRef<THREE.Vector3 | null>(null);
  // Dash phase: `offset` is the line material's dashOffset (shared by both lines); `tipPhase` is the
  // pattern's phase at the beam's end, held fixed while the end travels so the dashes look drawn.
  const dash = useRef({ offset: 0, tipPhase: 0 });
  const beamQ = useMemo(() => ({ a: new THREE.Quaternion(), end: new THREE.Vector3() }), []);

  useFrame(({ size }, dt) => {
    const m = moon.current;
    if (!m) return;
    // Momentum after a drag.
    const s = spin.current;
    if (!s.dragging && (Math.abs(s.vx) > 1e-4 || Math.abs(s.vy) > 1e-4)) {
      m.quaternion.premultiply(tmp.q.setFromAxisAngle(tmp.ax.set(0, 1, 0), s.vx * dt));
      m.quaternion.premultiply(tmp.q.setFromAxisAngle(tmp.ax.set(1, 0, 0), s.vy * dt));
      const k = Math.exp(-SPIN_DAMPING * dt);
      s.vx *= k;
      s.vy *= k;
    }
    // Where the site is now.
    tmp.site.copy(siteLocal).applyQuaternion(m.quaternion).add(MOON_AT);
    tmp.normal.copy(tmp.site).sub(MOON_AT).normalize();
    const facing = tmp.normal.dot(tmp.toCam.copy(camera.position).sub(tmp.site).normalize()) > 0.02;
    // Beam: Earth → site, drawn over the Moon.
    // Always over the Moon: drawn last, ignoring depth (set here so it reaches each line's own
    // material). A soft dark dashed outline under the blue dashes keeps it readable on bright ground.
    let moving = false;
    if (!beamDir.current) beamDir.current = tmp.normal.clone();
    else {
      // Move along the surface toward the site at the dashes' speed (arc length = angle × radius).
      const angle = beamDir.current.angleTo(tmp.normal);
      const step = (BEAM_SPEED * dt) / siteLocal.length();
      moving = angle > 1e-4;
      if (angle > 1e-5) {
        beamQ.a.setFromUnitVectors(beamDir.current, tmp.normal);
        beamDir.current.applyQuaternion(new THREE.Quaternion().slerp(beamQ.a, Math.min(1, step / angle))).normalize();
      }
    }
    const end = beamQ.end.copy(beamDir.current).multiplyScalar(siteLocal.length()).add(MOON_AT);
    const ends = [EARTH_AT.x, EARTH_AT.y, EARTH_AT.z, end.x, end.y, end.z];
    // In sync: while the end travels, keep the dash phase at the tip fixed (new dashes appear exactly
    // where the line grows, as if drawn); once it rests, the dashes flow toward the site at the same speed.
    const len = EARTH_AT.distanceTo(end);
    const d = dash.current;
    if (moving) d.offset = d.tipPhase - len;
    else d.offset -= BEAM_SPEED * dt;
    d.tipPhase = d.offset + len;
    for (const [line, order] of [
      [beamShade.current, 999],
      [beam.current, 1000],
    ] as const) {
      if (!line) continue;
      line.renderOrder = order;
      line.material.depthTest = false;
      line.material.depthWrite = false;
      line.geometry.setPositions(ends);
      line.computeLineDistances();
      line.material.dashOffset = d.offset;
    }
    // Pin + name (DOM): follow the site; hidden when it is on the far side.
    const el = pinEl.current;
    if (el) {
      const p = tmp.site.clone().project(camera);
      el.style.transform = `translate3d(${((p.x + 1) / 2) * size.width}px, ${((1 - p.y) / 2) * size.height}px, 0)`;
      el.dataset.hidden = String(!facing);
    }
  });

  return (
    <>
      {/* Lights for Earth only (the Moon has its own airless shading). */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[-3, 2, 4]} intensity={3.6} />
      <group ref={moon} position={MOON_AT} quaternion={start}>
        <MoonTrekGlobe light={light} onImageryReady={onReady} />
      </group>
      {/* Earth's map loads on its own, so it never holds up the Moon. */}
      <Suspense fallback={null}>
        <Earth contact={contact} />
      </Suspense>
      {contact && (
        <>
          <Line
            ref={beamShade as never}
            points={[EARTH_AT.toArray(), MOON_AT.toArray()]}
            color={color.bg}
            lineWidth={5}
            dashed
            dashSize={BEAM_DASH}
            gapSize={BEAM_GAP}
            transparent
            opacity={0.55}
          />
          <Line
            ref={beam as never}
            points={[EARTH_AT.toArray(), MOON_AT.toArray()]}
            color={color.earth}
            lineWidth={2.4}
            dashed
            dashSize={BEAM_DASH}
            gapSize={BEAM_GAP}
            transparent
            opacity={1}
          />
        </>
      )}
    </>
  );
}

export default function MissionGlobe3D(props: MissionGlobe3DProps) {
  const spin = useRef<Spin>({ dragging: false, vx: 0, vy: 0 });
  const pinEl = useRef<HTMLDivElement | null>(null);
  const moonRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const moon = useRef<THREE.Group | null>(null);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const ax = useMemo(() => new THREE.Vector3(), []);
  const turn = (dx: number, dy: number) => {
    const m = moon.current;
    if (!m) return;
    m.quaternion.premultiply(q.setFromAxisAngle(ax.set(0, 1, 0), dx));
    m.quaternion.premultiply(q.setFromAxisAngle(ax.set(1, 0, 0), dy));
  };

  // Drag spins the Moon about the screen's axes (left/right = around, up/down = over the top).
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    spin.current.dragging = true;
    spin.current.vx = spin.current.vy = 0;
    moonRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const last = moonRef.current;
    if (!spin.current.dragging || !last) return;
    const now = performance.now();
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    turn(dx * SPIN_PER_PX, dy * SPIN_PER_PX);
    const dts = Math.max(1, now - last.t) / 1000;
    spin.current.vx = (dx * SPIN_PER_PX) / dts;
    spin.current.vy = (dy * SPIN_PER_PX) / dts;
    moonRef.current = { x: e.clientX, y: e.clientY, t: now };
  };
  const onUp = () => {
    spin.current.dragging = false;
    moonRef.current = null;
  };

  return (
    <div
      className={[g.wrap, props.sunlit && g.sunlit].filter(Boolean).join(' ')}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="img"
      aria-label={`The Moon with ${props.siteName} ${props.sunlit ? 'in sunlight' : 'in shadow'}, Earth ${props.contact ? 'in sight' : 'out of sight'}. Drag to spin the Moon.`}
    >
      <Canvas camera={{ fov: 30, near: 0.05, far: 50, position: [0, 0, 5.4] }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <Scene {...props} spin={spin} pinEl={pinEl} moon={moon} />
      </Canvas>
      <div className={g.labels} aria-hidden>
        <div ref={pinEl} className={g.pin} data-hidden="true">
          <span className={g.ring} />
          <span className={g.dot} />
          <span className={g.name}>{props.siteName}</span>
        </div>
      </div>
      <span className={g.hint}>Drag to spin</span>
    </div>
  );
}
