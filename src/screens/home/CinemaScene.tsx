/**
 * Home's cinematic scene (Home-owned; src/scenes/HeroMoon.tsx is Pink's and is not used here).
 * A perspective camera sits on the tangent line over the Moon's south pole, looking toward Earth: the Moon is a
 * dome whose crest is the pole, and Earth hangs over the crest at true scale (see cinemaMath.ts).
 *
 * Nothing here touches React state per frame: the pin and the Earth label are moved with transform on refs,
 * and the intro drives `gate` (a plain mutable object) that the Moon's shader reads.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { MeshStandardMaterial, SRGBColorSpace, TextureLoader, Vector3, type DirectionalLight, type Group, type Texture } from 'three';
import { color } from '@/shared/theme/tokens';
import {
  CAMERA_BACK,
  CAMERA_LIFT,
  CREST_FROM_TOP,
  DESCENT_BACK,
  DESCENT_S,
  earthElevationDeg,
  earthPosition,
  EARTH_RADIUS,
  FOV,
  SUN_DIRECTION,
  cameraPitch,
} from './cinemaMath';
import { EarthLoop } from './EarthLoop';

/** The intro's handles into the shader. `first` 0→1: only the highest relief on the crest is lit. `edge`: lit where x < edge × viewport width. */
export interface CinemaGate {
  first: number;
  edge: number;
}
/** The state with everything lit (reduced motion, skip, and after the intro). */
export const GATE_DONE: CinemaGate = { first: 1, edge: 2 };

export interface CinemaHandle {
  /** Camera moves toward the pole until the dome has flattened into a horizon. Resolves when it arrives. */
  descend(): Promise<void>;
}

export interface CinemaSceneProps {
  gate: RefObject<CinemaGate>;
  /** Motion on: slow spin and Earth's libration loop. Off: Earth static, nothing moves. */
  motion: boolean;
  /** False while the tab is hidden: the render loop stops. */
  active: boolean;
  /** Translated each frame to the pole's screen position (the pin). */
  pinEl: RefObject<HTMLElement | null>;
  /** Translated to just beside Earth; opacity 0 when Earth is below the limb. */
  earthLabelEl: RefObject<HTMLElement | null>;
  onTextureReady?: () => void;
  onTextureFailed?: () => void;
}

/** NASA SVS CGI Moon Kit, converted to WebP in public/moon. */
const COLOR_MAP = '/moon/lroc_color_poles_2k.webp';
const LOLA_MAP = '/moon/ldem_3_8bit.webp';
const SPIN_RATE = 0.006; // rad/s, very slow
const LIGHT_INTENSITY = 3.1;
const AMBIENT = 0.025; // shadows very dark but not perfectly black
/** Thickness of the first-light band under the crest, as a fraction of the viewport height. */
const FIRST_BAND = 0.075;
/** Earth's elevation when it is static (reduced motion / motion off): visible just above the crest. */
const STATIC_EARTH_ELEV = 3.4;
/** The loop starts with Earth rising so it is above the crest when the intro ends. */
const LOOP_PHASE0 = 0.02;

function useMoonMaps(maxAnisotropy: number, onFailed?: () => void) {
  const [maps, setMaps] = useState<{ color: Texture; height: Texture } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const loader = new TextureLoader();
    const load = (url: string) => new Promise<Texture>((res, rej) => loader.load(url, res, undefined, rej));
    Promise.all([load(COLOR_MAP), load(LOLA_MAP)])
      .then(([c, h]) => {
        if (!alive) return;
        c.colorSpace = SRGBColorSpace; // colour map only; the height map is data
        c.anisotropy = maxAnisotropy; // the crest is seen at a grazing angle
        h.anisotropy = maxAnisotropy;
        setMaps({ color: c, height: h });
      })
      .catch(() => {
        if (!alive) return;
        setFailed(true);
        onFailed?.();
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxAnisotropy]);
  return { maps, failed };
}

/** The Moon with first light: the lit result is gated by relief height and a left-to-right light edge. */
function makeMoonMaterial(maps: { color: Texture; height: Texture } | null, gate: CinemaGate) {
  const material = new MeshStandardMaterial({
    color: maps ? undefined : color.textMuted,
    map: maps?.color,
    bumpMap: maps?.height,
    bumpScale: maps ? 3 : 0,
    roughness: 1,
    metalness: 0,
  });
  const uniforms = {
    uHeight: { value: maps?.height ?? null },
    uFirst: { value: gate.first },
    uEdge: { value: gate.edge * 1e4 }, // replaced with real pixels on the first frame; sign and size are what matter before
    uCrestY: { value: 0 },
    uBandPx: { value: 1 },
  };
  if (maps) {
    // Only patched when the map exists (vMapUv is only defined then); the plain fallback sphere is simply lit.
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform sampler2D uHeight;
uniform float uFirst;
uniform float uEdge;
uniform float uCrestY;
uniform float uBandPx;`,
        )
        .replace(
          '#include <opaque_fragment>',
          `// First light: only the highest relief, in a band just under the crest, so it reads as a thin broken line.
float relief = texture2D(uHeight, vMapUv).r;
// LOLA in the polar cap: p99 ≈ 0.66, p90 ≈ 0.54. Start with only the very highest relief, then widen.
float thr = mix(0.63, 0.54, uFirst);
float peaks = smoothstep(thr - 0.025, thr, relief);
float below = uCrestY - gl_FragCoord.y;
float band = step(0.0, below) * (1.0 - smoothstep(uBandPx * 0.55, uBandPx, below));
float firstLight = peaks * band * step(0.001, uFirst);
// Then the light spreads: everything left of the edge is lit.
float spread = 1.0 - smoothstep(uEdge - 24.0, uEdge + 24.0, gl_FragCoord.x);
outgoingLight *= max(firstLight, spread);
#include <opaque_fragment>`,
        );
    };
    material.customProgramCacheKey = () => 'cinema-moon-gate';
  }
  return { material, uniforms };
}

function Scene({
  gate,
  motion,
  pinEl,
  earthLabelEl,
  onTextureReady,
  onTextureFailed,
  rig,
}: Omit<CinemaSceneProps, 'active'> & { rig: { current: { back: number } } }) {
  const { camera, size, gl } = useThree();
  const maxAniso = useThree((st) => st.gl.capabilities.getMaxAnisotropy());
  const { maps, failed } = useMoonMaps(maxAniso, onTextureFailed);
  const spin = useRef<Group>(null);
  const light = useRef<DirectionalLight>(null);
  const signalled = useRef(false);
  const tmp = useMemo(() => new Vector3(), []);
  const last = useRef({ px: -1, py: -1 });
  const loopT = useRef(0);
  const earth = useRef<{ elev: number }>({ elev: STATIC_EARTH_ELEV });
  const pitch = cameraPitch();

  const { material, uniforms } = useMemo(() => makeMoonMaterial(maps, gate.current ?? GATE_DONE), [maps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => material.dispose(), [material]);

  // Aim before the first paint: otherwise the default camera shows for one frame.
  useLayoutEffect(() => {
    camera.position.set(0, 1 + CAMERA_LIFT, -rig.current.back);
    camera.lookAt(0, 1 + CAMERA_LIFT + Math.sin(pitch), -rig.current.back + Math.cos(pitch));
    camera.updateMatrixWorld();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, rawDt) => {
    // A long gap (tab was hidden) must not make anything jump.
    const dt = Math.min(rawDt, 0.1);
    const dpr = gl.getPixelRatio();
    const g = gate.current ?? GATE_DONE;

    if (motion && spin.current) spin.current.rotation.y += dt * SPIN_RATE;
    if (motion) loopT.current += dt;
    earth.current.elev = motion ? earthElevationDeg(loopT.current, LOOP_PHASE0) : STATIC_EARTH_ELEV;

    // The gate, in device pixels (gl_FragCoord is in device pixels).
    uniforms.uFirst.value = g.first;
    uniforms.uEdge.value = g.edge * size.width * dpr;
    uniforms.uCrestY.value = (1 - CREST_FROM_TOP) * size.height * dpr;
    uniforms.uBandPx.value = FIRST_BAND * size.height * dpr;

    // Camera on the tangent line over the pole, looking toward Earth with the horizon at the crest height.
    camera.position.set(0, 1 + CAMERA_LIFT, -rig.current.back);
    camera.lookAt(0, 1 + CAMERA_LIFT + Math.sin(pitch), -rig.current.back + Math.cos(pitch));
    camera.updateMatrixWorld();

    // The pin sits on the pole. Moved with transform only, on the ref, no React state.
    if (pinEl.current) {
      const v = tmp.set(0, 1, 0).project(camera);
      const px = Math.round((v.x * 0.5 + 0.5) * size.width * 2) / 2;
      const py = Math.round((-v.y * 0.5 + 0.5) * size.height * 2) / 2;
      if (px !== last.current.px || py !== last.current.py) {
        last.current = { px, py };
        pinEl.current.style.transform = `translate3d(${px}px, ${py}px, 0)`;
        pinEl.current.dataset.placed = '1';
      }
    }

    if (maps && !signalled.current) {
      signalled.current = true;
      onTextureReady?.();
    }
  });

  return (
    <>
      <directionalLight ref={light} position={SUN_DIRECTION.map((v) => v * 10) as [number, number, number]} intensity={LIGHT_INTENSITY} />
      <ambientLight intensity={AMBIENT} />
      {/* Flip so the Moon's south pole (−Y in its own frame) is on top, at the crest. Spin is about the pole axis. */}
      <group rotation={[0, 0, Math.PI]}>
        <group ref={spin} rotation={[0, 1.2, 0]}>
          {/* Nothing until the NASA textures are in (or loading has failed): the plain sphere would flash on first. */}
          {(maps || failed) && (
            <mesh material={material}>
              <sphereGeometry args={[1, 192, 192]} />
            </mesh>
          )}
        </group>
      </group>
      <EarthLoop earth={earth} gate={gate} labelEl={earthLabelEl} />
    </>
  );
}

export const CinemaScene = forwardRef<CinemaHandle, CinemaSceneProps>(function CinemaScene({ active, ...props }, ref) {
  const rig = useRef({ back: CAMERA_BACK });
  useImperativeHandle(
    ref,
    () => ({
      descend: () =>
        new Promise<void>((resolve) => {
          gsap.to(rig.current, { back: DESCENT_BACK, duration: DESCENT_S, ease: 'power2.in', onComplete: resolve });
        }),
    }),
    [],
  );
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      camera={{ fov: FOV, near: 0.01, far: 1200, position: [0, 1 + CAMERA_LIFT, -CAMERA_BACK] }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene {...props} rig={rig} />
    </Canvas>
  );
});

// Re-exported so callers can size the label offset against the real Earth size.
export { EARTH_RADIUS, earthPosition };
