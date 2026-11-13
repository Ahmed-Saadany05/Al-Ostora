/**
 * LAUNCH → ARRIVAL — Earth–Moon orbit view (owner: Pink). Loaded lazily by LaunchSequence.
 *
 * Earth at the centre, the Moon's orbit as a white dotted loop whose dots drift the way the Moon
 * travels, a faint "ghost" Moon where it will be when the rocket arrives, and the rocket as a
 * pulsing white dot on a dashed, non-animated trajectory. A timelapse runs launch → arrival: the
 * Moon moves to the ghost while the rocket follows its path; then the camera closes in and hands
 * over to the landing view. Positions come from an OrbitProvider (placeholder model for now).
 * Earth and Moon are drawn enlarged so they read at this scale (labelled on screen).
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { formatUtc } from '@/shared/format';
import { color } from '@/shared/theme/tokens';
import { EARTH_RADIUS_KM, MOON_RADIUS_KM, moonOrbitPath, rocketPath, type OrbitProvider, type Vec3 } from './orbit';
import l from './launch.module.css';

/** Scene units: 1 = 10,000 km. */
const KM = 1 / 10_000;
/** Bodies drawn larger than life so they are visible at Earth–Moon scale. */
export const SIZE_BOOST = 4;
const INTRO_S = 1.6;
const TRANSIT_S = 7;
const ARRIVE_S = 1.8;

/** Ecliptic km → scene (ecliptic plane = XZ, ecliptic north = +Y). */
const toScene = (v: Vec3): THREE.Vector3 => new THREE.Vector3(v[0] * KM, v[2] * KM, -v[1] * KM);
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

export interface LaunchOrbit3DProps {
  provider: OrbitProvider;
  launchIso: string;
  arrivalIso: string;
  siteName: string;
  /** Skip all motion: show the arrival state and finish. */
  instant?: boolean;
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
}

function earthTexture() {
  const w = 256;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1f4f8f';
  g.fillRect(0, 0, w, h);
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 18; i++) {
    g.fillStyle = r() > 0.5 ? '#4f7a3a' : '#8a7a55';
    g.beginPath();
    g.ellipse(r() * w, h * 0.2 + r() * h * 0.6, 10 + r() * 30, 6 + r() * 20, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    g.ellipse(r() * w, r() * h, 6 + r() * 20, 2 + r() * 4, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Scene({ provider, launchIso, arrivalIso, instant, onDone, hud }: LaunchOrbit3DProps & { hud: MutableRefObject<Hud> }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const t0 = Date.parse(launchIso);
  const t1 = Date.parse(arrivalIso);

  const orbitPts = useMemo(() => moonOrbitPath(provider, launchIso).map(toScene), [provider, launchIso]);
  const tripPts = useMemo(() => rocketPath(provider, launchIso, arrivalIso).map(toScene), [provider, launchIso, arrivalIso]);
  const arrival = useMemo(() => toScene(provider.moonAt(arrivalIso)), [provider, arrivalIso]);
  const sunDir = useMemo(() => toScene(provider.sunDirAt(launchIso)).normalize(), [provider, launchIso]);
  const earthMap = useMemo(earthTexture, []);

  const moon = useRef<THREE.Mesh>(null);
  const ghost = useRef<THREE.MeshBasicMaterial>(null);
  const orbitLine = useRef<{ material: { dashOffset: number; opacity: number } } | null>(null);
  const clock = useRef(instant ? INTRO_S + TRANSIT_S + ARRIVE_S : 0);
  const finished = useRef(false);

  // Overview: from above and behind Earth, framing Earth and the whole orbit, centred a little toward arrival.
  const overview = useMemo(() => {
    const centre = arrival.clone().multiplyScalar(0.25);
    const r = Math.max(...orbitPts.map((p) => p.length()));
    const dist = (r * 1.25) / Math.tan(THREE.MathUtils.degToRad(20));
    const back = arrival.clone().setY(0).normalize().multiplyScalar(-1);
    const pos = centre.clone().add(back.multiplyScalar(dist * 0.62)).add(new THREE.Vector3(0, dist * 0.78, 0));
    return { pos, look: centre };
  }, [arrival, orbitPts]);
  const close = useMemo(() => {
    const out = arrival.clone().normalize();
    const pos = arrival.clone().add(out.multiplyScalar(-9)).add(new THREE.Vector3(0, 5, 0));
    return { pos, look: arrival };
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
    clock.current += Math.min(dt, 1 / 20);
    const c = clock.current;
    const k = THREE.MathUtils.clamp((c - INTRO_S) / TRANSIT_S, 0, 1); // trip progress
    const arriveK = THREE.MathUtils.clamp((c - INTRO_S - TRANSIT_S) / ARRIVE_S, 0, 1);
    const simMs = t0 + (t1 - t0) * k;
    const simIso = new Date(simMs).toISOString();

    // Moon where it is at the simulated moment; rocket on its path.
    const m = toScene(provider.moonAt(simIso));
    moon.current?.position.copy(m);
    const rocket = toScene(provider.rocketAt(k, launchIso, arrivalIso));

    // Orbit dots drift forward (the way the Moon moves); ghost fades as the Moon reaches it.
    if (orbitLine.current) {
      orbitLine.current.material.dashOffset -= dt * 1.2;
      orbitLine.current.material.opacity = 0.55 * Math.min(1, c / 0.8);
    }
    if (ghost.current) ghost.current.opacity = 0.22 * (1 - THREE.MathUtils.smoothstep(k, 0.9, 1));

    // Camera: overview, then close in on the Moon at arrival.
    const e = ease(arriveK);
    camera.position.lerpVectors(overview.pos, close.pos, e);
    look.lerpVectors(overview.look, close.look, e);
    camera.lookAt(look);

    // HUD.
    const h = hud.current;
    proj(rocket, h.rocket, size, arriveK < 0.6);
    proj(rocket, h.toast, size, c < 6);
    proj(new THREE.Vector3(0, EARTH_RADIUS_KM * KM * SIZE_BOOST * 1.2, 0), h.earth, size);
    proj(m.clone().add(new THREE.Vector3(0, MOON_RADIUS_KM * KM * SIZE_BOOST * 1.5, 0)), h.moon, size);
    proj(arrival.clone().add(new THREE.Vector3(0, -MOON_RADIUS_KM * KM * SIZE_BOOST * 1.5, 0)), h.ghost, size, k < 0.9);
    if (h.sim) h.sim.textContent = `Day ${((simMs - t0) / 86_400_000).toFixed(1)} of ${((t1 - t0) / 86_400_000).toFixed(1)} · ${formatUtc(simIso)}`;
    if (h.phase) h.phase.textContent = k <= 0 ? 'Liftoff' : k < 0.08 ? 'Trans-lunar injection' : k < 1 ? 'Coasting to the Moon' : 'Arrival';

    if (c >= INTRO_S + TRANSIT_S + ARRIVE_S && !finished.current) {
      finished.current = true;
      onDone();
    }
  });

  const moonR = MOON_RADIUS_KM * KM * SIZE_BOOST;
  const earthR = EARTH_RADIUS_KM * KM * SIZE_BOOST;
  return (
    <>
      <ambientLight intensity={0.06} />
      <directionalLight position={sunDir.clone().multiplyScalar(100)} intensity={2.6} />

      <mesh rotation={[0.41, 0, 0]}>
        <sphereGeometry args={[earthR, 48, 32]} />
        <meshStandardMaterial map={earthMap} roughness={0.85} />
      </mesh>
      <mesh ref={moon}>
        <sphereGeometry args={[moonR, 32, 24]} />
        <meshStandardMaterial color={new THREE.Color(0.62, 0.61, 0.59)} roughness={1} />
      </mesh>
      {/* Where the Moon will be when the rocket arrives. */}
      <mesh position={arrival}>
        <sphereGeometry args={[moonR, 32, 24]} />
        <meshBasicMaterial ref={ghost} color={color.text} transparent opacity={0.22} depthWrite={false} />
      </mesh>

      {/* The Moon's orbit: white dots, drifting in its direction of travel. */}
      <Line
        ref={orbitLine as never}
        points={orbitPts}
        color={color.text}
        lineWidth={1.6}
        dashed
        dashSize={0.35}
        gapSize={0.9}
        transparent
        opacity={0}
      />
      {/* The rocket's path: dashed, not animated, not white. */}
      <Line points={tripPts} color={color.warn} lineWidth={1.6} dashed dashSize={0.9} gapSize={0.6} transparent opacity={0.85} />
    </>
  );
}

export default function LaunchOrbit3D(props: LaunchOrbit3DProps) {
  const hud = useRef<Hud>({ sim: null, phase: null, rocket: null, toast: null, earth: null, moon: null, ghost: null });
  const bind = (k: keyof Hud) => (el: HTMLElement | null) => {
    hud.current[k] = el;
  };
  return (
    <div className={l.view}>
      <Canvas dpr={[1, 2]} camera={{ fov: 40, near: 0.05, far: 2000 }} gl={{ antialias: true }}>
        <color attach="background" args={[color.bg]} />
        <Scene {...props} hud={hud} />
      </Canvas>

      <div className={l.labels} aria-hidden>
        <div ref={bind('earth')} className={l.anchor}>
          <span className={l.name}>Earth</span>
        </div>
        <div ref={bind('moon')} className={l.anchor}>
          <span className={l.name}>Moon</span>
        </div>
        <div ref={bind('ghost')} className={l.anchor}>
          <span className={[l.name, l.ghostName].join(' ')}>Moon on arrival · {formatUtc(props.arrivalIso, false)}</span>
        </div>
        <div ref={bind('rocket')} className={l.anchor}>
          <span className={l.rocket} />
        </div>
        <div ref={bind('toast')} className={l.anchor}>
          <span className={l.toast}>Your rocket</span>
        </div>
      </div>

      <div className={l.hud}>
        <span ref={bind('phase')} className={l.phase}>
          Liftoff
        </span>
        <span ref={bind('sim')} className={['num', l.sim].join(' ')} />
        <span className={l.dest}>→ {props.siteName}</span>
      </div>
      {props.provider.placeholder && (
        <span className={l.note}>
          {props.provider.label} · Earth and Moon drawn ×{SIZE_BOOST}
        </span>
      )}
    </div>
  );
}
