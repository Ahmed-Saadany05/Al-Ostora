/**
 * HOME MOON — owner: Pink. The NASA Moon Trek Moon behind Hady's Home hero.
 *
 * Same props and handle as Hady's stub (src/screens/home/HeroMoon.tsx re-exports this):
 *   handle.playLightSweep(seconds), handle.diveToSouthPole(), handle.enterStep1(); props autoRotate,
 *   tiltTowardSouthPole, highlightedPin, startDark, onTextureReady, onTextureFailed, onPinScreen,
 *   onDiveComplete.
 *
 * "Planet horizon" framing (Hady's): a sphere far wider than the viewport, so only its top arc shows —
 * a dome whose crest sits at CREST_FROM_TOP of the height. The camera is a perspective camera so far
 * away that it looks flat (orthographic); during the flight it moves in to exactly Step 1's camera
 * (distance, focal length, centre of view), so the hand-off frame matches Step 1 pixel for pixel. The surface is Moon Trek imagery (LRO WAC) streamed with
 * 3d-tiles-renderer and lit with the airless shading shared with the step 1 globe.
 *
 * Going to Step 1 (click the Moon, or handle.enterStep1() from "Begin the journey"): the Moon is
 * pulled up off the bottom of the page and back, shrinking into Step 1's place on the left while it
 * turns to Step 1's opening view and light. The last frame is handed to Step 1 (globe/moonHandoff),
 * so the page change itself is invisible.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { PerformanceMonitor } from '@react-three/drei';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Euler, Matrix4, PerspectiveCamera, Quaternion, Vector3, type Group } from 'three';
import { missionUrl } from '@/shared/mission';
import { useApp } from '@/shared/store/app';
import { MoonTrekGlobe } from './globe/MoonTrekGlobe';
import { createMoonLight } from './globe/moonShading';
import { VIEWER_LIGHT } from './globe/pickerTypes';
import { OPENING_VIEW, pickerDisc, preloadPickerGlobe, setMoonHandoff, type Rect } from './globe/moonHandoff';
import { latLonToVec } from './lib/moonFrame';

export interface HeroMoonPin {
  id: string;
  lat: number;
  lon: number;
  label: string;
}

export interface HeroMoonProps {
  autoRotate: boolean;
  tiltTowardSouthPole: boolean;
  highlightedPin: HeroMoonPin | null;
  onDiveComplete?: () => void;
  /** Start unlit so the intro can sweep the light across. */
  startDark?: boolean;
  /** Called once the first Moon Trek imagery is on the sphere — also if it arrives after onTextureFailed. */
  onTextureReady?: () => void;
  /** Called if the imagery did not arrive in time (the plain sphere shows meanwhile). */
  onTextureFailed?: () => void;
  /** Pin position in CSS pixels, relative to this component's box. */
  onPinScreen?: (p: { x: number; y: number } | null) => void;
}

export interface HeroMoonHandle {
  diveToSouthPole(): void;
  playLightSweep(seconds: number): void;
  /** Fly the Moon into Step 1 and open it ("Begin the journey"). */
  enterStep1(): void;
}

/** Where the top of the dome sits, as a fraction of the canvas height measured from the top. */
const CREST_FROM_TOP = 0.55;
/** Sphere radius as a multiple of the canvas width (diameter ≈ 1.8 × the viewport). */
const RADIUS_PER_WIDTH = 0.9;
/** Tip the pole slightly toward the viewer so the crest shows some surface, radians. */
const LEAN_TOWARD_VIEWER = 0.2;
/** Very slow spin, radians per second. */
const SPIN_RATE = 0.008;
/** Light direction: sweeps from the left, round the back, to a low grazing angle on the right. */
const LIGHT_HEIGHT = 0.25;
const SWEEP_FROM = Math.PI;
const SWEEP_TO = Math.PI * 2 + 0.1;
/** Full exposure of the airless shading (see globe/moonShading). */
const EXPOSURE = 1.25;
/** Intro, before the light sweep: a dim, evenly lit Moon so you can see it rise into frame. */
const RISE_EXPOSURE = 0.35;
const RISE_FLOOR = 0.3;
/** If no imagery has arrived by then, report a failure so the intro never waits for nothing. */
const IMAGERY_TIMEOUT_MS = 12_000;
/** The flight into Step 1. */
const FLIGHT_SECONDS = 1.6;
/** Home camera distance in lunar radii: far enough that the dome looks orthographic. */
const HOME_DISTANCE = 40;

/** On-screen Moon disc: centre (canvas px from the top-left) and radius (px), seen from `d` radii. */
interface View {
  d: number;
  r: number;
  cx: number;
  cy: number;
}

/**
 * Points the camera at the Moon (unit sphere at the origin) from `d` radii away with the focal length
 * that makes its disc `r` px wide, and shifts the centre of view so the disc centre lands at (cx, cy).
 */
function applyView(cam: PerspectiveCamera, v: View, w: number, h: number) {
  const f = v.r * Math.sqrt(v.d * v.d - 1); // focal length in px
  cam.position.set(0, 0, v.d);
  cam.lookAt(0, 0, 0);
  cam.fov = (2 * Math.atan(h / 2 / f) * 180) / Math.PI;
  cam.aspect = w / h;
  cam.near = Math.max(0.001, v.d - 1.5);
  cam.far = v.d + 2;
  cam.setViewOffset(w, h, w / 2 - v.cx, h / 2 - v.cy, w, h);
  cam.updateProjectionMatrix();
}

const toScene = (v: { x: number; y: number; z: number }) => new Vector3(v.x, v.z, -v.y);

/**
 * The Moon's orientation that matches Step 1's opening camera: its camera looks at the
 * Moon from OPENING_VIEW with north up; here the camera looks down −Z, so turn the Moon instead.
 */
function openingPose() {
  const d = toScene(latLonToVec(OPENING_VIEW.lat, OPENING_VIEW.lon)).normalize();
  const look = new Matrix4().lookAt(d, new Vector3(), new Vector3(0, 1, 0));
  const q = new Quaternion().setFromRotationMatrix(look).invert();
  return { q };
}

type Controls = {
  dive: () => void;
  sweep: (sec: number) => void;
  fly: (target: { x: number; y: number; radius: number; distance: number }, done: (snapshot: string | null) => void) => void;
};

function Scene({
  autoRotate,
  tiltTowardSouthPole,
  highlightedPin,
  onDiveComplete,
  startDark,
  onTextureReady,
  onTextureFailed,
  onPinScreen,
  controls,
  onMoonClick,
}: HeroMoonProps & { controls: { current: Controls | null }; onMoonClick: () => void }) {
  const camera = useThree((st) => st.camera) as PerspectiveCamera;
  const gl = useThree((st) => st.gl);
  const { width, height } = useThree((st) => st.size);
  const orient = useRef<Group>(null);
  const pinAnchor = useRef<Group>(null);
  const lastPin = useRef<{ x: number; y: number } | null>(null);
  const tmp = useMemo(() => new Vector3(), []);
  const sweep = useRef({ p: startDark ? 0 : 1 });
  const spinAngle = useRef(0);
  const light = useMemo(createMoonLight, []);
  const ready = useRef(false);
  const flight = useRef<{
    t: number;
    from: View;
    to: View;
    q0: Quaternion;
    q1: Quaternion;
    sun0: Vector3;
    sun1: Vector3;
    done: (snapshot: string | null) => void;
    finished: boolean;
  } | null>(null);
  const q = useMemo(() => ({ lean: new Quaternion(), tilt: new Quaternion(), spin: new Quaternion(), e: new Euler() }), []);

  // Imagery arrives → tell the page (credit + intro start). Too slow → report failure so the intro
  // can go on, but if the imagery still arrives later, report it then too: it is on screen, so the
  // page must show its credit.
  const onImageryReady = () => {
    if (ready.current) return;
    ready.current = true;
    onTextureReady?.();
  };
  useEffect(() => {
    const t = setTimeout(() => {
      if (!ready.current) onTextureFailed?.();
    }, IMAGERY_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const radius = width * RADIUS_PER_WIDTH;
  const homeView = (): View => ({ d: HOME_DISTANCE, r: radius, cx: width / 2, cy: CREST_FROM_TOP * height + radius });
  // R3F would reset the aspect on resize; this component owns the projection.
  useEffect(() => {
    (camera as PerspectiveCamera & { manual?: boolean }).manual = true;
  }, [camera]);

  controls.current = {
    dive: () => {
      gsap.to(camera, {
        zoom: 2.4,
        duration: autoRotate ? 1.6 : 0,
        ease: 'power3.inOut',
        onUpdate: () => camera.updateProjectionMatrix(),
        onComplete: onDiveComplete,
      });
    },
    sweep: (sec) => {
      gsap.killTweensOf(sweep.current);
      if (sec <= 0) sweep.current.p = 1;
      else gsap.to(sweep.current, { p: 1, duration: sec, ease: 'power2.inOut' });
    },
    fly: (target, done) => {
      if (flight.current || !orient.current) return;
      gsap.killTweensOf(sweep.current);
      sweep.current.p = 1;
      const pose = openingPose();
      flight.current = {
        t: 0,
        from: homeView(),
        to: { d: target.distance, r: target.radius, cx: target.x, cy: target.y },
        q0: orient.current.quaternion.clone(),
        q1: pose.q,
        sun0: light.uSun.value.clone(),
        // End on Step 1's light: from the viewer, slightly above-left (Home's camera looks down −Z, up +Y).
        sun1: new Vector3(-VIEWER_LIGHT.left, VIEWER_LIGHT.up, 1).normalize(),
        done,
        finished: false,
      };
    },
  };

  useFrame((_, dt) => {
    const o = orient.current;
    const f = flight.current;

    if (f && o) {
      f.t = Math.min(1, f.t + Math.min(dt, 1 / 30) / FLIGHT_SECONDS);
      const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2; // ease in-out
      // Size and distance on a log scale, so it reads as the Moon receding; the centre slides.
      applyView(
        camera,
        {
          d: f.from.d * Math.pow(f.to.d / f.from.d, e),
          r: f.from.r * Math.pow(f.to.r / f.from.r, e),
          cx: f.from.cx + (f.to.cx - f.from.cx) * e,
          cy: f.from.cy + (f.to.cy - f.from.cy) * e,
        },
        width,
        height,
      );
      o.quaternion.slerpQuaternions(f.q0, f.q1, e);
      light.uSun.value.copy(f.sun0).lerp(f.sun1, e).normalize();
      light.uExposure.value = EXPOSURE;
      light.uNightFloor.value = 0.035;
      if (f.t >= 1 && !f.finished) {
        f.finished = true;
        // Snapshot after this frame has been drawn, then hand over.
        requestAnimationFrame(() => {
          let snapshot: string | null = null;
          try {
            snapshot = gl.domElement.toDataURL('image/png');
          } catch {
            snapshot = null;
          }
          f.done(snapshot);
        });
      }
      return;
    }

    // Home pose: dome lean, south pole at the crest, slow spin.
    if (autoRotate) spinAngle.current += dt * SPIN_RATE;
    if (o) {
      q.lean.setFromEuler(q.e.set(LEAN_TOWARD_VIEWER, 0, 0));
      q.tilt.setFromEuler(q.e.set(0, 0, tiltTowardSouthPole ? Math.PI : 0));
      q.spin.setFromEuler(q.e.set(0, spinAngle.current, 0));
      o.quaternion.copy(q.lean).multiply(q.tilt).multiply(q.spin);
    }
    if (camera.zoom === 1 || !gsap.isTweening(camera)) applyView(camera, homeView(), width, height);

    // World-space light direction for the airless shading, plus the intro fade-in.
    const sp = sweep.current.p;
    const az = SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * sp;
    light.uSun.value.set(Math.cos(az), LIGHT_HEIGHT, Math.sin(az)).normalize();
    // Before the sweep the Moon is dim but visible (as if in earthshine), so the intro's rise reads.
    const lit = Math.min(1, sp * 3);
    light.uExposure.value = EXPOSURE * (RISE_EXPOSURE + (1 - RISE_EXPOSURE) * lit);
    light.uNightFloor.value = RISE_FLOOR + (0.035 - RISE_FLOOR) * lit;

    // Project the pin to CSS pixels so the page can draw it as real, focusable DOM.
    if (pinAnchor.current && onPinScreen) {
      const v = pinAnchor.current.getWorldPosition(tmp).project(camera);
      const x = Math.round((v.x * 0.5 + 0.5) * width);
      const y = Math.round((-v.y * 0.5 + 0.5) * height);
      if (!lastPin.current || lastPin.current.x !== x || lastPin.current.y !== y) {
        lastPin.current = { x, y };
        onPinScreen({ x, y });
      }
    }
  });

  const pinAt = useMemo(() => {
    if (!highlightedPin) return null;
    // Same frame as MoonTrekGlobe's scene (x = 0° lon, y = north, z = 90° W), on a unit sphere.
    const v = latLonToVec(highlightedPin.lat, highlightedPin.lon, 1.002);
    return [v.x, v.z, -v.y] as [number, number, number];
  }, [highlightedPin]);

  return (
    <group>
      <group ref={orient}>
        <MoonTrekGlobe light={light} onImageryReady={onImageryReady} />
        {pinAt && <group ref={pinAnchor} position={pinAt} />}
        {/* Click target: the Moon itself (not the sky around it) opens Step 1. */}
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            onMoonClick();
          }}
          onPointerOver={() => (gl.domElement.style.cursor = 'pointer')}
          onPointerOut={() => (gl.domElement.style.cursor = '')}
        >
          <sphereGeometry args={[1, 64, 48]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

export const HeroMoon = forwardRef<HeroMoonHandle, HeroMoonProps & { label: string }>(function HeroMoon({ label, ...props }, ref) {
  const controls = useRef<Controls | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const motion = useApp((st) => st.motion);
  const leaving = useRef(false);
  // Sharp on capable screens; drops to 1× if frames start to slip (slower laptops), back up if it recovers.
  const maxDpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  const [dpr, setDpr] = useState(maxDpr);

  const enter = () => {
    if (leaving.current) return;
    leaving.current = true;
    const loaded = preloadPickerGlobe().catch(() => undefined);
    const el = box.current;
    if (!motion || !controls.current || !el) {
      void loaded.then(() => navigate(missionUrl.chooseSite()));
      return;
    }
    // Target: Step 1's Moon disc, in this canvas's pixels (from its top-left).
    const r = el.getBoundingClientRect();
    const disc = pickerDisc();
    const target = { x: disc.x - r.left, y: disc.y - r.top, radius: disc.radius, distance: disc.distance };
    const rect: Rect = { left: r.left, top: r.top, width: r.width, height: r.height };
    // Everything else on Home steps back while the Moon flies.
    const section = el.closest('section');
    const others = section ? [...section.querySelectorAll<HTMLElement>('[data-intro], [data-home-fade]')] : [];
    gsap.to(others, { opacity: 0, y: -10, duration: 0.5, ease: 'power2.in', stagger: 0.04 });
    // Home's own stars and black backdrop give way to the app-wide drifting stars that Step 1 also
    // shows, so no star jumps at the page change.
    const stars = section?.querySelector<HTMLElement>('[data-home-stars]');
    if (stars) gsap.to(stars, { opacity: 0, duration: FLIGHT_SECONDS * 0.8, ease: 'none' });
    if (section) gsap.to(section, { backgroundColor: 'rgba(0, 0, 0, 0)', duration: FLIGHT_SECONDS * 0.8, ease: 'none' });
    controls.current.fly(target, (snapshot) => {
      setMoonHandoff({ snapshot, rect });
      void loaded.then(() => navigate(missionUrl.chooseSite()));
    });
  };

  useImperativeHandle(
    ref,
    () => ({
      diveToSouthPole: () => controls.current?.dive(),
      playLightSweep: (sec) => controls.current?.sweep(sec),
      enterStep1: enter,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [motion],
  );

  return (
    <div ref={box} style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        camera={{ position: [0, 0, HOME_DISTANCE], fov: 10, near: 0.1, far: 100 }}
        dpr={dpr}
        // Keeps the last frame readable for the hand-off snapshot.
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        aria-label={label}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr)} flipflops={3} onFallback={() => setDpr(1)} />
        <Scene {...props} controls={controls} onMoonClick={enter} />
      </Canvas>
    </div>
  );
});
