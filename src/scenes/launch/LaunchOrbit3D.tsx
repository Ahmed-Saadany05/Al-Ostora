/**
 * LAUNCH → ARRIVAL — Earth–Moon orbit view (owner: Pink). Loaded lazily by LaunchSequence.
 *
 * Earth (three.js example texture, MIT; source not stated) at the centre and the real Moon (NASA Moon Trek imagery, near side toward
 * Earth, lit from the Sun's actual direction) on its orbit: a fine white dotted loop whose dots drift
 * the way the Moon travels. A faint "ghost" Moon marks where it will be when the rocket arrives; the
 * rocket is a pulsing white dot on a dashed, non-animated trajectory. A timelapse runs launch →
 * arrival, the camera closes in on the Moon, and then it WAITS: "Tap the Moon to land". Clicking the
 * Moon (or the prompt) hands over to the landing view.
 *
 * Positions come from an OrbitProvider (placeholder model for now). Earth and Moon are drawn
 * enlarged so they read at this scale (said on screen).
 */
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Suspense, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { formatUtc } from '@/shared/format';
import { color } from '@/shared/theme/tokens';
import { DisplayHeading, Icon } from '@/shared/ui';
import { MoonTrekGlobe } from '../globe/MoonTrekGlobe';
import { createMoonLight } from '../globe/moonShading';
import { EARTH_RADIUS_KM, MOON_RADIUS_KM, moonOrbitPath, rocketPath, type OrbitProvider, type Vec3 } from './orbit';
import l from './launch.module.css';

/** Scene units: 1 = 10,000 km. */
const KM = 1 / 10_000;
/** Bodies drawn larger than life so they are visible at Earth–Moon scale. */
const EARTH_BOOST = 19;
const MOON_BOOST = 17;
const EARTH_R = EARTH_RADIUS_KM * KM * EARTH_BOOST;
const MOON_R = MOON_RADIUS_KM * KM * MOON_BOOST;
const INTRO_S = 1.6;
const TRANSIT_S = 7;
const ARRIVE_S = 2;
const END_S = INTRO_S + TRANSIT_S + ARRIVE_S;
/** Camera height above the orbit plane, degrees (low and cinematic, as in the reference). */
const VIEW_ELEVATION_DEG = 26;

/** Ecliptic km → scene (ecliptic plane = XZ, ecliptic north = +Y). */
const toScene = (v: Vec3): THREE.Vector3 => new THREE.Vector3(v[0] * KM, v[2] * KM, -v[1] * KM);
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

export interface LaunchOrbit3DProps {
  provider: OrbitProvider;
  launchIso: string;
  arrivalIso: string;
  siteName: string;
  /** Skip the motion: start at the arrival state (the prompt still waits for a tap). */
  instant?: boolean;
  /** The user tapped the Moon (or the prompt) after arrival. */
  onDone: () => void;
}

interface Hud {
  sim: HTMLElement | null;
  phase: HTMLElement | null;
  rocket: HTMLElement | null;
  toast: HTMLElement | null;
  earth: HTMLElement | null;
  moon: HTMLElement | null;
  ghost: HTMLElement | null;
  tap: HTMLElement | null;
}

/** Earth: three.js example texture (MIT; original source not stated), axial tilt, slow spin, a thin atmosphere rim. */
function Earth() {
  const map = useLoader(THREE.TextureLoader, '/earth/earth_atmos_2048.jpg');
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
  }, [map]);
  const spin = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.05;
  });
  return (
    <group rotation={[0, 0, THREE.MathUtils.degToRad(23.4)]}>
      <mesh ref={spin}>
        <sphereGeometry args={[EARTH_R, 64, 48]} />
        <meshStandardMaterial map={map} roughness={0.75} metalness={0} emissive={color.earth} emissiveIntensity={0.03} />
      </mesh>
      <mesh scale={1.03}>
        <sphereGeometry args={[EARTH_R, 48, 32]} />
        <meshBasicMaterial color={color.earth} transparent opacity={0.09} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Scene({
  provider,
  launchIso,
  arrivalIso,
  instant,
  onDone,
  hud,
  onArrived,
}: LaunchOrbit3DProps & { hud: MutableRefObject<Hud>; onArrived: () => void }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const t0 = Date.parse(launchIso);
  const t1 = Date.parse(arrivalIso);

  const orbitPts = useMemo(() => moonOrbitPath(provider, launchIso).map(toScene), [provider, launchIso]);
  const tripPts = useMemo(() => rocketPath(provider, launchIso, arrivalIso).map(toScene), [provider, launchIso, arrivalIso]);
  const arrival = useMemo(() => toScene(provider.moonAt(arrivalIso)), [provider, arrivalIso]);
  const sunDir = useMemo(() => toScene(provider.sunDirAt(launchIso)).normalize(), [provider, launchIso]);
  // The Moon's airless shading, driven from here: world-space Sun direction, a little earthshine.
  const light = useMemo(() => {
    const m = createMoonLight();
    m.uSun.value.copy(sunDir);
    m.uNightFloor.value = 0.06;
    return m;
  }, [sunDir]);

  const moon = useRef<THREE.Group>(null);
  const ghost = useRef<THREE.MeshBasicMaterial>(null);
  const orbitLine = useRef<{ material: { dashOffset: number; opacity: number } } | null>(null);
  const clock = useRef(instant ? END_S : 0);
  const arrived = useRef(false);

  // Overview: low over the orbit plane, from the Sun's side (so Earth and Moon show their lit faces,
  // as in the reference), turned a little so the orbit reads as an ellipse.
  const overview = useMemo(() => {
    const r = Math.max(...orbitPts.map((p) => Math.hypot(p.x, p.z)));
    const horiz = new THREE.Vector3(sunDir.x, 0, sunDir.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(28));
    const dist = r * 3.4;
    const el = THREE.MathUtils.degToRad(VIEW_ELEVATION_DEG);
    return { pos: horiz.multiplyScalar(dist * Math.cos(el)).setY(dist * Math.sin(el)), look: new THREE.Vector3(0, -r * 0.05, 0) };
  }, [sunDir, orbitPts]);
  // Close: in front of the Moon's near side, slightly to one side and above.
  const close = useMemo(() => {
    const toEarth = arrival.clone().multiplyScalar(-1).normalize();
    const side = new THREE.Vector3().crossVectors(toEarth, new THREE.Vector3(0, 1, 0)).normalize();
    const pos = arrival
      .clone()
      .add(toEarth.multiplyScalar(MOON_R * 7))
      .add(side.multiplyScalar(MOON_R * 2.5))
      .add(new THREE.Vector3(0, MOON_R * 1.4, 0));
    return { pos, look: arrival.clone() };
  }, [arrival]);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const proj = (v: THREE.Vector3, el: HTMLElement | null, size: { width: number; height: number }, show = true) => {
    if (!el) return;
    tmp.copy(v).project(camera);
    const hidden = !show || tmp.z > 1;
    el.style.visibility = hidden ? 'hidden' : 'visible';
    el.style.transform = `translate3d(${((tmp.x + 1) / 2) * size.width}px, ${((1 - tmp.y) / 2) * size.height}px, 0)`;
  };

  useFrame(({ size }, dt) => {
    clock.current = Math.min(END_S, clock.current + Math.min(dt, 1 / 20));
    const c = clock.current;
    const k = THREE.MathUtils.clamp((c - INTRO_S) / TRANSIT_S, 0, 1); // trip progress
    const arriveK = THREE.MathUtils.clamp((c - INTRO_S - TRANSIT_S) / ARRIVE_S, 0, 1);
    const simMs = t0 + (t1 - t0) * k;
    const simIso = new Date(simMs).toISOString();

    // Moon where it is at that moment, near side toward Earth (tidally locked).
    const m = toScene(provider.moonAt(simIso));
    if (moon.current) {
      moon.current.position.copy(m);
      moon.current.rotation.set(0, Math.atan2(m.z, -m.x), 0); // 0° longitude faces Earth
    }
    const rocket = toScene(provider.rocketAt(k, launchIso, arrivalIso));

    // Orbit dots drift forward; ghost fades as the Moon reaches it.
    if (orbitLine.current) {
      orbitLine.current.material.dashOffset -= dt * 0.9;
      orbitLine.current.material.opacity = 0.5 * Math.min(1, c / 0.8) * (1 - 0.6 * arriveK);
    }
    if (ghost.current) ghost.current.opacity = 0.2 * (1 - THREE.MathUtils.smoothstep(k, 0.9, 1));

    // Camera: overview, then close in on the Moon.
    const e = ease(arriveK);
    camera.position.lerpVectors(overview.pos, close.pos, e);
    look.lerpVectors(overview.look, close.look, e);
    camera.lookAt(look);

    // HUD.
    const h = hud.current;
    proj(rocket, h.rocket, size, arriveK < 0.5);
    proj(rocket, h.toast, size, c < 6);
    proj(new THREE.Vector3(0, EARTH_R * 1.25, 0), h.earth, size, arriveK < 0.4);
    proj(m.clone().add(new THREE.Vector3(0, MOON_R * 1.35, 0)), h.moon, size, arriveK < 0.4);
    proj(arrival.clone().add(new THREE.Vector3(0, -MOON_R * 1.35, 0)), h.ghost, size, k < 0.9);
    proj(m.clone().add(new THREE.Vector3(0, -MOON_R * 1.2, 0)), h.tap, size, arriveK >= 1);
    if (h.sim) h.sim.textContent = `Day ${((simMs - t0) / 86_400_000).toFixed(1)} of ${((t1 - t0) / 86_400_000).toFixed(1)} · ${formatUtc(simIso)}`;
    if (h.phase) h.phase.textContent = k <= 0 ? 'Liftoff' : k < 0.08 ? 'Leaving Earth' : k < 1 ? 'Coasting to the Moon' : 'Arrived in lunar orbit';

    if (arriveK >= 1 && !arrived.current) {
      arrived.current = true;
      onArrived();
    }
  });

  return (
    <>
      <ambientLight intensity={0.12} />
      <directionalLight position={sunDir.clone().multiplyScalar(100)} intensity={4} />

      <Suspense fallback={null}>
        <Earth />
      </Suspense>

      {/* The real Moon (Moon Trek), scaled from 1 radius to its drawn size. */}
      <group ref={moon}>
        <group scale={MOON_R}>
          <MoonTrekGlobe light={light} />
        </group>
        {/* Tap target, live once arrived. */}
        <mesh
          onClick={(ev) => {
            ev.stopPropagation();
            if (arrived.current) onDone();
          }}
          onPointerOver={() => {
            if (arrived.current) gl.domElement.style.cursor = 'pointer';
          }}
          onPointerOut={() => (gl.domElement.style.cursor = '')}
        >
          <sphereGeometry args={[MOON_R * 1.1, 24, 16]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} />
        </mesh>
      </group>

      {/* Where the Moon will be when the rocket arrives. */}
      <mesh position={arrival}>
        <sphereGeometry args={[MOON_R, 32, 24]} />
        <meshBasicMaterial ref={ghost} color={color.text} transparent opacity={0.2} depthWrite={false} />
      </mesh>

      {/* The Moon's orbit: fine white dots, drifting in its direction of travel. */}
      <Line ref={orbitLine as never} points={orbitPts} color={color.text} lineWidth={1} dashed dashSize={0.18} gapSize={0.42} transparent opacity={0} />
      {/* The rocket's path: dashed, not animated, not white. */}
      <Line points={tripPts} color={color.warn} lineWidth={1.4} dashed dashSize={0.9} gapSize={0.6} transparent opacity={0.85} />
    </>
  );
}

export default function LaunchOrbit3D(props: LaunchOrbit3DProps) {
  const hud = useRef<Hud>({ sim: null, phase: null, rocket: null, toast: null, earth: null, moon: null, ghost: null, tap: null });
  const [arrived, setArrived] = useState(false);
  const bind = (k: keyof Hud) => (el: HTMLElement | null) => {
    hud.current[k] = el;
  };
  const days = (Date.parse(props.arrivalIso) - Date.parse(props.launchIso)) / 86_400_000;

  return (
    <div className={l.view}>
      <Canvas dpr={[1, 2]} camera={{ fov: 40, near: 0.05, far: 2000 }} gl={{ antialias: true, alpha: true }}>
        <Scene {...props} hud={hud} onArrived={() => setArrived(true)} />
      </Canvas>

      <div className={l.labels}>
        <div ref={bind('earth')} className={l.anchor} aria-hidden>
          <span className={l.name}>Earth</span>
        </div>
        <div ref={bind('moon')} className={l.anchor} aria-hidden>
          <span className={l.name}>Moon</span>
        </div>
        <div ref={bind('ghost')} className={l.anchor} aria-hidden>
          <span className={[l.name, l.ghostName].join(' ')}>Moon on arrival · {formatUtc(props.arrivalIso, false)}</span>
        </div>
        <div ref={bind('rocket')} className={l.anchor} aria-hidden>
          <span className={l.rocket} />
        </div>
        <div ref={bind('toast')} className={l.anchor} aria-hidden>
          <span className={l.toast}>Your rocket</span>
        </div>
        <div ref={bind('tap')} className={l.anchor}>
          {arrived && (
            <button type="button" className={l.tap} onClick={props.onDone}>
              <span className={l.tapDot} aria-hidden />
              Tap the Moon to land
            </button>
          )}
        </div>
      </div>

      {/* Left: the story, laid out like the reference. */}
      <div className={l.intro}>
        <span className={l.eyebrow}>
          <Icon name="plus" size={12} /> Trans-lunar journey
        </span>
        <DisplayHeading as="h1" size="xl" align="left" accent={`${props.siteName}.`}>
          Earth to Moon.
        </DisplayHeading>
        <p className={l.lead}>
          A <span className="num">{days.toFixed(1)}</span>-day coast. The Moon keeps moving,
          <br />
          so you aim for where it will be.
        </p>
      </div>

      {/* Top-right: what this view is. */}
      <div className={l.system}>
        <span className={l.systemTitle}>Earth–Moon system</span>
        <span className={l.systemNote}>
          {props.provider.placeholder ? 'Approximate orbit · placeholder trajectory' : props.provider.label} · bodies enlarged
        </span>
      </div>

      {/* Bottom: launch, now, touchdown, as glass cards like the reference. */}
      <div className={l.cards}>
        <div className={l.card}>
          <Icon name="clock" size={16} />
          <span>
            <strong>Launch</strong>
            <small className="num">{formatUtc(props.launchIso)}</small>
          </span>
        </div>
        <div className={[l.card, l.cardNow].join(' ')}>
          <Icon name="orbit" size={16} />
          <span>
            <strong ref={bind('phase')}>Liftoff</strong>
            <small ref={bind('sim')} className="num" />
          </span>
        </div>
        <div className={l.card}>
          <Icon name="pin" size={16} />
          <span>
            <strong>Touchdown</strong>
            <small className="num">{formatUtc(props.arrivalIso)}</small>
          </span>
        </div>
      </div>
    </div>
  );
}
