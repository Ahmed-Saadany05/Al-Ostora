/**
 * STUB — same props as Pink's real Moon will have (see home-spec.md). Replace the body, keep the props.
 * Owner of the real thing: Pink (src/scenes). Remove this file when it lands.
 *
 * Extras Home needs that Pink's Moon must also offer (not in the original spec):
 *   - handle.playLightSweep(seconds): the intro light sweep (0 = jump to the final light)
 *   - props startDark, onTextureReady, onPinScreen
 *
 * "Planet horizon" framing: an orthographic camera (world units = CSS pixels) looks at a sphere far wider
 * than the viewport, so only its top arc shows — a dome whose crest sits at CREST_FROM_TOP of the height.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { DirectionalLight, SRGBColorSpace, TextureLoader, Vector3, type Group, type Texture } from 'three';
import { color } from '@/shared/theme/tokens';

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
  /** Called once the NASA texture is on the sphere and a frame has been drawn. Never called on failure. */
  onTextureReady?: () => void;
  /** Called if the texture could not be loaded; the plain sphere stays. */
  onTextureFailed?: () => void;
  /** Pin position in CSS pixels, relative to this component's box. */
  onPinScreen?: (p: { x: number; y: number } | null) => void;
}

export interface HeroMoonHandle {
  diveToSouthPole(): void;
  playLightSweep(seconds: number): void;
}

/** NASA SVS CGI Moon Kit, converted to WebP (see public/moon). */
const COLOR_MAP = '/moon/lroc_color_poles_2k.webp';
const LOLA_MAP = '/moon/ldem_3_8bit.webp';

/** Where the top of the dome sits, as a fraction of the canvas height measured from the top. */
const CREST_FROM_TOP = 0.55;
/** Sphere radius as a multiple of the canvas width (diameter ≈ 1.8 × the viewport). */
const RADIUS_PER_WIDTH = 0.9;
/** Tip the pole slightly toward the viewer so the crest shows some surface, radians. */
const LEAN_TOWARD_VIEWER = 0.2;
/** Very slow spin, radians per second. */
const SPIN_RATE = 0.008;
const LIGHT_INTENSITY = 2.8;
const LIGHT_HEIGHT = 0.25;
const LIGHT_DISTANCE = 6;
/** Light azimuth: sweeps from the left, round the back, to a low grazing angle on the right. */
const SWEEP_FROM = Math.PI;
const SWEEP_TO = Math.PI * 2 + 0.1;
const DEG = Math.PI / 180;

/** lat/lon (deg) → point on the unit sphere, in the sphere's own frame. */
function surfacePoint(lat: number, lon: number): [number, number, number] {
  return [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.sin(lat * DEG), -Math.cos(lat * DEG) * Math.sin(lon * DEG)];
}

interface Maps {
  color: Texture;
  bump: Texture | null;
}

function useMoonMaps(maxAnisotropy: number, onFailed?: () => void): Maps | null {
  const [maps, setMaps] = useState<Maps | null>(null);
  useEffect(() => {
    let alive = true;
    const loader = new TextureLoader();
    const load = (url: string) => new Promise<Texture>((res, rej) => loader.load(url, res, undefined, rej));
    Promise.all([load(COLOR_MAP), load(LOLA_MAP).catch(() => null)])
      .then(([c, b]) => {
        if (!alive) return;
        c.colorSpace = SRGBColorSpace; // colour map only; the bump map is data
        c.anisotropy = maxAnisotropy; // the crest is seen at a grazing angle
        if (b) b.anisotropy = maxAnisotropy;
        setMaps({ color: c, bump: b });
      })
      .catch(() => {
        /* No texture: the plain sphere stays and no credit is shown. */
        if (alive) onFailed?.();
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxAnisotropy]);
  return maps;
}

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
}: HeroMoonProps & { controls: { current: { dive: () => void; sweep: (sec: number) => void } | null } }) {
  const camera = useThree((st) => st.camera);
  const maxAniso = useThree((st) => st.gl.capabilities.getMaxAnisotropy());
  const { width, height } = useThree((st) => st.size);
  const spin = useRef<Group>(null);
  const pinAnchor = useRef<Group>(null);
  const light = useRef<DirectionalLight>(null);
  const lastPin = useRef<{ x: number; y: number } | null>(null);
  const tmp = useRef(new Vector3());
  const sweep = useRef({ p: startDark ? 0 : 1 });
  const signalled = useRef(false);
  const maps = useMoonMaps(maxAniso, onTextureFailed);

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
  };

  useFrame((_, dt) => {
    if (autoRotate && spin.current) spin.current.rotation.y += dt * SPIN_RATE;

    if (light.current) {
      const p = sweep.current.p;
      const az = SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * p;
      light.current.position.set(Math.cos(az) * LIGHT_DISTANCE, LIGHT_HEIGHT, Math.sin(az) * LIGHT_DISTANCE);
      light.current.intensity = LIGHT_INTENSITY * Math.min(1, p * 3);
    }

    // Project the pin to CSS pixels so the page can draw it as real, focusable DOM.
    if (pinAnchor.current && onPinScreen) {
      const v = pinAnchor.current.getWorldPosition(tmp.current).project(camera);
      const x = Math.round((v.x * 0.5 + 0.5) * width);
      const y = Math.round((-v.y * 0.5 + 0.5) * height);
      if (!lastPin.current || lastPin.current.x !== x || lastPin.current.y !== y) {
        lastPin.current = { x, y };
        onPinScreen({ x, y });
      }
    }

    // First frame with the texture applied → tell the page (credit + intro start).
    if (maps && !signalled.current) {
      signalled.current = true;
      onTextureReady?.();
    }
  });

  const radius = width * RADIUS_PER_WIDTH;
  const crestY = height / 2 - CREST_FROM_TOP * height;

  return (
    <>
      {/* Low, grazing light: crater walls facing it are lit, the rest fall into shadow. */}
      <directionalLight ref={light} position={[LIGHT_DISTANCE, LIGHT_HEIGHT, 0]} intensity={startDark ? 0 : LIGHT_INTENSITY} />
      <ambientLight intensity={0.03} />
      <group position={[0, crestY - radius, 0]} scale={radius}>
        {/* Lean the pole toward the viewer, then flip it to the top: the south pole sits at the crest. */}
        <group rotation={[LEAN_TOWARD_VIEWER, 0, 0]}>
          <group rotation={[0, 0, tiltTowardSouthPole ? Math.PI : 0]}>
            <group ref={spin}>
              <mesh>
                <sphereGeometry args={[1, 192, 192]} />
                {/* Bump (shading) from LOLA, not displacement: displacement pinches at the pole. */}
                {/* key: adding a map after first render needs a recompiled material. */}
                <meshStandardMaterial
                  key={maps ? 'textured' : 'plain'}
                  color={maps ? undefined : color.textMuted}
                  map={maps?.color}
                  bumpMap={maps?.bump ?? undefined}
                  bumpScale={maps?.bump ? 4 : 0}
                  roughness={1}
                  metalness={0}
                />
              </mesh>
              {highlightedPin && (
                <group ref={pinAnchor} position={surfacePoint(highlightedPin.lat, highlightedPin.lon).map((v) => v * 1.002) as [number, number, number]} />
              )}
            </group>
          </group>
        </group>
      </group>
    </>
  );
}

export const HeroMoon = forwardRef<HeroMoonHandle, HeroMoonProps & { label: string }>(function HeroMoon({ label, ...props }, ref) {
  const controls = useRef<{ dive: () => void; sweep: (sec: number) => void } | null>(null);
  useImperativeHandle(
    ref,
    () => ({ diveToSouthPole: () => controls.current?.dive(), playLightSweep: (sec) => controls.current?.sweep(sec) }),
    [],
  );
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas orthographic camera={{ position: [0, 0, 3000], zoom: 1, near: 1, far: 6000 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} aria-label={label}>
        <Scene {...props} controls={controls} />
      </Canvas>
    </div>
  );
});
