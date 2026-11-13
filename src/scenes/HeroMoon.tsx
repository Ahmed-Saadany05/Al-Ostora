/**
 * HOME MOON — owner: Pink. The NASA Moon Trek Moon behind Hady's Home hero.
 *
 * Same props and handle as Hady's stub (src/screens/home/HeroMoon.tsx re-exports this):
 *   handle.playLightSweep(seconds), handle.diveToSouthPole(); props autoRotate, tiltTowardSouthPole,
 *   highlightedPin, startDark, onTextureReady, onTextureFailed, onPinScreen, onDiveComplete.
 *
 * "Planet horizon" framing (Hady's): an orthographic camera (world units = CSS pixels) looks at a
 * sphere far wider than the viewport, so only its top arc shows — a dome whose crest sits at
 * CREST_FROM_TOP of the height. The surface is Moon Trek imagery (LRO WAC) streamed with
 * 3d-tiles-renderer and lit with the airless shading shared with the step 1 globe.
 *
 * Clicking the Moon pushes in towards the crest and opens Step 1, whose globe continues the move
 * (see globe/moonHandoff.ts).
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Vector3, type Group } from 'three';
import { missionUrl } from '@/shared/mission';
import { useApp } from '@/shared/store/app';
import { MoonTrekGlobe } from './globe/MoonTrekGlobe';
import { markMoonHandoff, preloadPickerGlobe } from './globe/moonHandoff';
import { createMoonLight } from './globe/moonShading';
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
  /** Called once the first Moon Trek imagery is on the sphere. Never called on failure. */
  onTextureReady?: () => void;
  /** Called if the imagery did not arrive in time; the plain sphere stays. */
  onTextureFailed?: () => void;
  /** Pin position in CSS pixels, relative to this component's box. */
  onPinScreen?: (p: { x: number; y: number } | null) => void;
}

export interface HeroMoonHandle {
  diveToSouthPole(): void;
  playLightSweep(seconds: number): void;
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
/** If no imagery has arrived by then, report a failure so the intro never waits for nothing. */
const IMAGERY_TIMEOUT_MS = 12_000;

type Controls = { dive: () => void; sweep: (sec: number) => void; enter: (done: () => void) => void };
/** Clicking the Moon: a short push in towards the crest (the south pole) before Step 1 takes over. */
const ENTER_ZOOM = 1.9;
const ENTER_SECONDS = 0.75;

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
  const camera = useThree((st) => st.camera);
  const gl = useThree((st) => st.gl);
  const { width, height } = useThree((st) => st.size);
  const spin = useRef<Group>(null);
  const pinAnchor = useRef<Group>(null);
  const lastPin = useRef<{ x: number; y: number } | null>(null);
  const tmp = useMemo(() => new Vector3(), []);
  const sweep = useRef({ p: startDark ? 0 : 1 });
  const light = useMemo(createMoonLight, []);
  const ready = useRef(false);

  // Imagery arrives → tell the page (credit + intro start). Too slow → report failure instead.
  const onImageryReady = () => {
    if (ready.current) return;
    ready.current = true;
    onTextureReady?.();
  };
  useEffect(() => {
    const t = setTimeout(() => {
      if (!ready.current) {
        ready.current = true;
        onTextureFailed?.();
      }
    }, IMAGERY_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    enter: (done) => {
      gsap.killTweensOf(camera);
      gsap.to(camera, {
        zoom: ENTER_ZOOM,
        duration: ENTER_SECONDS,
        ease: 'power2.in',
        onUpdate: () => camera.updateProjectionMatrix(),
        onComplete: done,
      });
    },
    sweep: (sec) => {
      gsap.killTweensOf(sweep.current);
      if (sec <= 0) sweep.current.p = 1;
      else gsap.to(sweep.current, { p: 1, duration: sec, ease: 'power2.inOut' });
    },
  };

  useFrame((_, dt) => {
    if (autoRotate && spin.current) spin.current.rotation.y += dt * SPIN_RATE;

    // World-space light direction for the airless shading, plus the intro fade-in.
    const p = sweep.current.p;
    const az = SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * p;
    light.uSun.value.set(Math.cos(az), LIGHT_HEIGHT, Math.sin(az)).normalize();
    light.uExposure.value = EXPOSURE * Math.min(1, p * 3);
    light.uNightFloor.value = 0.035 * Math.min(1, p * 3);

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

  const radius = width * RADIUS_PER_WIDTH;
  const crestY = height / 2 - CREST_FROM_TOP * height;
  const pinAt = useMemo(() => {
    if (!highlightedPin) return null;
    // Same frame as MoonTrekGlobe's scene (x = 0° lon, y = north, z = 90° W), on a unit sphere.
    const v = latLonToVec(highlightedPin.lat, highlightedPin.lon, 1.002);
    return [v.x, v.z, -v.y] as [number, number, number];
  }, [highlightedPin]);

  return (
    <group position={[0, crestY - radius, 0]} scale={radius}>
      {/* Lean the pole toward the viewer, then flip it to the top: the south pole sits at the crest. */}
      <group rotation={[LEAN_TOWARD_VIEWER, 0, 0]}>
        <group rotation={[0, 0, tiltTowardSouthPole ? Math.PI : 0]}>
          <group ref={spin}>
            <MoonTrekGlobe light={light} onImageryReady={onImageryReady} />
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
            {pinAt && <group ref={pinAnchor} position={pinAt} />}
          </group>
        </group>
      </group>
    </group>
  );
}

export const HeroMoon = forwardRef<HeroMoonHandle, HeroMoonProps & { label: string }>(function HeroMoon({ label, ...props }, ref) {
  const controls = useRef<Controls | null>(null);
  const navigate = useNavigate();
  const motion = useApp((st) => st.motion);
  const leaving = useRef(false);
  // Click the Moon → push in, then Step 1 picks up the same Moon and pulls back out (moonHandoff).
  const enter = () => {
    if (leaving.current) return;
    leaving.current = true;
    const loaded = preloadPickerGlobe().catch(() => undefined);
    const go = () => {
      markMoonHandoff();
      navigate(missionUrl.chooseSite());
    };
    if (!motion || !controls.current) {
      void loaded.then(go);
      return;
    }
    controls.current.enter(() => void loaded.then(go));
  };
  useImperativeHandle(
    ref,
    () => ({ diveToSouthPole: () => controls.current?.dive(), playLightSweep: (sec) => controls.current?.sweep(sec) }),
    [],
  );
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas orthographic camera={{ position: [0, 0, 3000], zoom: 1, near: 1, far: 6000 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} aria-label={label}>
        <Scene {...props} controls={controls} onMoonClick={enter} />
      </Canvas>
    </div>
  );
});
