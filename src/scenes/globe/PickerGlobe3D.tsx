/**
 * The 3D part of SitePickerGlobe (owner: Pink), loaded lazily so three.js and the tile renderer
 * only download on step 1. Board tasks "Moon Trek globe" + "Regions globe".
 *
 * NASA Moon Trek imagery on a 3D Moon: drag to turn, scroll to zoom, click a pin to select a site,
 * click anywhere else to drop a pin at exact coordinates (→ onPickCoords). Region outlines follow
 * the same rule as `customSite()` in @/shared/mission.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { formatLatLon } from '@/shared/format';
import { color } from '@/shared/theme/tokens';
import { useApp } from '@/shared/store/app';
import type { Site, SiteKind } from '@/shared/types';
import { Icon, Pill, Tabs, type IconName } from '@/shared/ui';
import type { SitePickerGlobeProps } from '../contracts';
import { MoonTrekGlobe } from './MoonTrekGlobe';
import {
  MOON_RADIUS_M,
  REGION_LABEL,
  latLonToVec,
  pickLatLon,
  regionAt,
  regionOutline,
  type LatLon,
  type RegionId,
  type Vec3,
} from '../lib/moonFrame';
import { MOON_TREK_CREDIT, MOON_TREK_LAYERS, type MoonLayerId } from '../lib/moonTrek';
import g from './globe.module.css';

// ---------------------------------------------------------------- helpers

/** Moon-fixed (Z-up) vector → scene (Y-up), the same turn MoonTrekGlobe applies to its body. */
const toScene = (v: Vec3) => new THREE.Vector3(v.x, v.z, -v.y);
const START_DISTANCE = 4.4; // the whole disc fits the 32° view with a margin
/** Opening view: above the last selected site, else from 55° S so the south pole (the challenge focus) and near side show. */
const startPosition = (site?: Site) =>
  toScene(site ? latLonToVec(THREE.MathUtils.clamp(site.lat, -75, 75), site.lon, START_DISTANCE) : latLonToVec(-55, 8, START_DISTANCE));
const MIN_DISTANCE = 1.025; // ≈ 43 km above the surface
const MAX_DISTANCE = 6;
const LABELS_BELOW_DISTANCE = 1.6;
const CLICK_SLOP_PX = 5;

const KIND_ICON: Record<SiteKind, IconName> = {
  'artemis-candidate': 'pin',
  'historic-landing': 'check',
  'failed-landing': 'alert',
  custom: 'plus',
};
const KIND_WORD: Record<SiteKind, string> = {
  'artemis-candidate': 'Artemis candidate',
  'historic-landing': 'Landing site',
  'failed-landing': 'Landing attempt',
  custom: 'Your pin',
};

// ---------------------------------------------------------------- 3D pieces

function RegionOutlines({ hovered }: { hovered: RegionId | null }) {
  const lines = useMemo(
    () =>
      (['south-pole', 'north-pole', 'nearside', 'farside'] as RegionId[]).map((id) => ({
        id,
        polylines: regionOutline(id).map((line) =>
          line.map((p) => {
            const v = latLonToVec(p.lat, p.lon, MOON_RADIUS_M * 1.0008);
            return [v.x, v.y, v.z] as [number, number, number];
          }),
        ),
      })),
    [],
  );
  return (
    <>
      {lines.map(({ id, polylines }) =>
        polylines.map((points, i) => (
          <Line
            key={`${id}-${i}`}
            points={points}
            color={color.text}
            transparent
            opacity={id === hovered ? 0.85 : 0.18}
            lineWidth={id === hovered ? 1.6 : 1}
            renderOrder={id === hovered ? 2 : 1}
          />
        )),
      )}
    </>
  );
}

/** A surface point that a DOM element follows on screen (site pins, the click ripple). */
interface Anchor {
  id: string;
  lat: number;
  lon: number;
}
type AnchorEls = MutableRefObject<Map<string, HTMLElement>>;
const RIPPLE_ID = '__ripple';

/**
 * Projects surface anchors to the screen every frame and moves their DOM elements there.
 * Plain DOM in the same React tree (no per-pin React roots), no re-render per frame.
 * Anchors on the far side of the Moon are hidden.
 */
function ScreenAnchors({ anchors, els }: { anchors: Anchor[]; els: AnchorEls }) {
  const group = useRef<THREE.Group>(null);
  const frame = useThree((st) => st.gl.domElement.closest('[data-globe]'));
  const p = useMemo(() => new THREE.Vector3(), []);
  const toCam = useMemo(() => new THREE.Vector3(), []);
  const local = useMemo(
    () => anchors.map((a) => ({ id: a.id, v: latLonToVec(a.lat, a.lon, MOON_RADIUS_M * 1.0015) })),
    [anchors],
  );
  useFrame(({ camera, size }) => {
    const parent = group.current;
    if (!parent) return;
    for (const { id, v } of local) {
      const el = els.current.get(id);
      if (!el) continue;
      p.set(v.x, v.y, v.z).applyMatrix4(parent.matrixWorld);
      // The Moon is at the origin, so the world position is also the surface normal.
      const facing = p.dot(toCam.subVectors(camera.position, p)) > 0;
      p.project(camera);
      const hidden = String(!facing || p.z > 1);
      if (el.dataset.hidden !== hidden) el.dataset.hidden = hidden;
      el.style.transform = `translate3d(${((p.x + 1) / 2) * size.width}px, ${((1 - p.y) / 2) * size.height}px, 0)`;
    }
    frame?.classList.toggle(g.showLabels, camera.position.length() < LABELS_BELOW_DISTANCE);
  });
  return <group ref={group} />;
}

/** The site pins and the click ripple, as DOM over the canvas (positioned by ScreenAnchors). */
function MarkerLayer({
  sites,
  selectedIds,
  onSelectSite,
  ripple,
  els,
}: {
  sites: Site[];
  selectedIds: string[];
  onSelectSite: (id: string) => void;
  ripple: (LatLon & { key: number }) | null;
  els: AnchorEls;
}) {
  const bind = (id: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };
  return (
    <div className={g.anchors}>
      {sites.map((site) => {
        const selected = selectedIds.includes(site.id);
        return (
          <div key={site.id} ref={bind(site.id)} className={g.anchor} data-hidden="true">
            <button
              type="button"
              className={[g.marker, selected && g.selected].filter(Boolean).join(' ')}
              onClick={() => onSelectSite(site.id)}
              aria-pressed={selected}
              title={`${site.name} · ${KIND_WORD[site.kind]} · ${formatLatLon(site.lat, site.lon)}`}
            >
              <span className={g.dot} />
              <span className={g.label}>
                <Icon name={KIND_ICON[site.kind]} size={12} />
                {site.kind === 'custom' ? formatLatLon(site.lat, site.lon, 2) : site.name}
                {selected && <em>· Selected</em>}
              </span>
            </button>
          </div>
        );
      })}
      {ripple && (
        <div key={ripple.key} ref={bind(RIPPLE_ID)} className={g.anchor} data-hidden="true">
          <span className={g.ripple} />
        </div>
      )}
    </div>
  );
}

/** Keeps zoom and turn speed proportional to the altitude, so close views stay controllable. */
function AltitudeAwareControls({ motion }: { motion: boolean }) {
  const controls = useThree((s) => s.controls) as unknown as { rotateSpeed: number; zoomSpeed: number } | null;
  useFrame(({ camera }) => {
    if (!controls) return;
    const altitude = Math.max(camera.position.length() - 1, 0.001);
    controls.rotateSpeed = THREE.MathUtils.clamp(altitude * 0.55, 0.03, 0.9);
    controls.zoomSpeed = THREE.MathUtils.clamp(altitude * 0.6, 0.15, 1);
  });
  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      enableDamping={motion}
      dampingFactor={0.08}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
    />
  );
}

/** Turns the camera to face a site when it is newly selected (instant when motion is off). */
function FocusOn({ target, motion }: { target: LatLon | null; motion: boolean }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { update: () => void } | null;
  const flight = useRef<{ from: THREE.Vector3; to: THREE.Vector3; d0: number; d1: number; t: number } | null>(null);

  useEffect(() => {
    if (!target) return;
    // Keep the camera off the exact poles: the polar sites read best from an oblique view.
    const to = toScene(latLonToVec(THREE.MathUtils.clamp(target.lat, -75, 75), target.lon)).normalize();
    const from = camera.position.clone().normalize();
    if (from.angleTo(to) < THREE.MathUtils.degToRad(6)) return;
    const dist = Math.min(camera.position.length(), START_DISTANCE);
    if (!motion) {
      camera.position.copy(to.multiplyScalar(dist));
      controls?.update();
      return;
    }
    // Turn along the great circle and ease the distance towards a comfortable framing.
    flight.current = { from, to, d0: camera.position.length(), d1: dist, t: 0 };
  }, [target, camera, controls, motion]);

  const q = useMemo(() => new THREE.Quaternion(), []);
  const full = useMemo(() => new THREE.Quaternion(), []);
  useFrame((_, dt) => {
    const f = flight.current;
    if (!f) return;
    f.t = Math.min(1, f.t + Math.min(dt, 0.05) / 1.1);
    const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
    full.setFromUnitVectors(f.from, f.to);
    q.identity().slerp(full, e);
    camera.position.copy(f.from).applyQuaternion(q).multiplyScalar(THREE.MathUtils.lerp(f.d0, f.d1, e));
    controls?.update();
    if (f.t >= 1) flight.current = null;
  });
  return null;
}

interface SceneProps {
  layer: MoonLayerId;
  motion: boolean;
  focus: LatLon | null;
  anchors: Anchor[];
  els: AnchorEls;
  onHover: (p: LatLon | null) => void;
  onPick: (p: LatLon) => void;
  onImageryReady: () => void;
}

function Scene({ layer, motion, focus, anchors, els, onHover, onPick, onImageryReady }: SceneProps) {
  const body = useRef<THREE.Group>(null);
  const [hoverRegion, setHoverRegion] = useState<RegionId | null>(null);
  const inverse = useMemo(() => new THREE.Matrix4(), []);
  const ray = useMemo(() => new THREE.Ray(), []);

  const surfaceAt = useCallback(
    (e: ThreeEvent<PointerEvent | MouseEvent>): LatLon | null => {
      const b = body.current;
      if (!b) return null;
      inverse.copy(b.matrixWorld).invert();
      ray.copy(e.ray).applyMatrix4(inverse);
      return pickLatLon(ray.origin, ray.direction, MOON_RADIUS_M);
    },
    [inverse, ray],
  );

  const move = (e: ThreeEvent<PointerEvent>) => {
    const p = surfaceAt(e);
    onHover(p);
    const r = p ? regionAt(p.lat, p.lon) : null;
    if (r !== hoverRegion) setHoverRegion(r);
  };
  const leave = () => {
    onHover(null);
    setHoverRegion(null);
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > CLICK_SLOP_PX) return; // that was a drag
    const p = surfaceAt(e);
    if (p) onPick(p);
  };

  return (
    <>
      <MoonTrekGlobe ref={body} layer={layer} onImageryReady={onImageryReady}>
        <RegionOutlines hovered={hoverRegion} />
        <ScreenAnchors anchors={anchors} els={els} />
      </MoonTrekGlobe>
      {/* Invisible hit sphere: the exact pick is analytic (pickLatLon), so it works while tiles stream. */}
      <mesh onPointerMove={move} onPointerOut={leave} onClick={click}>
        <sphereGeometry args={[1, 96, 64]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
      <AltitudeAwareControls motion={motion} />
      <FocusOn target={focus} motion={motion} />
    </>
  );
}

// ---------------------------------------------------------------- component

export default function PickerGlobe3D({ sites, selectedIds, onSelectSite, onPickCoords }: SitePickerGlobeProps) {
  const motion = useApp((s) => s.motion);
  const [layer, setLayer] = useState<MoonLayerId>('mosaic');
  const [imageryReady, setImageryReady] = useState(false);
  const [region, setRegion] = useState<RegionId | null>(null);
  const [ripple, setRipple] = useState<(LatLon & { key: number }) | null>(null);
  const coords = useRef<HTMLSpanElement>(null);
  const [start] = useState(() => startPosition(sites.find((x) => x.id === selectedIds[selectedIds.length - 1])));

  // Face the most recently selected site — also once on arrival, when the catalogue loads after
  // the globe (a link like /mission?sites=shackleton-rim opens looking at Shackleton).
  const previous = useRef<string[]>(selectedIds);
  const arrived = useRef(false);
  const [focus, setFocus] = useState<LatLon | null>(null);
  useEffect(() => {
    const added = selectedIds.filter((id) => !previous.current.includes(id));
    previous.current = selectedIds;
    const wanted = added.length ? added[added.length - 1] : arrived.current ? undefined : selectedIds[selectedIds.length - 1];
    const site = sites.find((x) => x.id === wanted);
    if (site) arrived.current = true;
    if (site && site.kind !== 'custom') setFocus({ lat: site.lat, lon: site.lon });
  }, [selectedIds, sites]);

  const onHover = useCallback((p: LatLon | null) => {
    // Written straight to the DOM: no React re-render on every mouse move.
    if (coords.current) coords.current.textContent = p ? formatLatLon(p.lat, p.lon, 4) : '';
    setRegion(p ? regionAt(p.lat, p.lon) : null);
  }, []);
  const onPick = useCallback(
    (p: LatLon) => {
      setRipple({ ...p, key: Date.now() });
      onPickCoords?.(p.lat, p.lon);
    },
    [onPickCoords],
  );
  const onImageryReady = useCallback(() => setImageryReady(true), []);
  const els = useRef(new Map<string, HTMLElement>());
  const anchors = useMemo<Anchor[]>(
    () => [...sites.map(({ id, lat, lon }) => ({ id, lat, lon })), ...(ripple ? [{ id: RIPPLE_ID, lat: ripple.lat, lon: ripple.lon }] : [])],
    [sites, ripple],
  );

  return (
    <div
      className={g.frame}
      data-globe
      role="application"
      aria-label="3D Moon. Drag to turn, scroll to zoom. Select a site with its pin, or click anywhere on the Moon to drop a pin at those coordinates."
    >
      <Canvas
        camera={{ fov: 32, near: 0.002, far: 40, position: start }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene
          layer={layer}
          motion={motion}
          focus={focus}
          anchors={anchors}
          els={els}
          onHover={onHover}
          onPick={onPick}
          onImageryReady={onImageryReady}
        />
      </Canvas>
      <MarkerLayer sites={sites} selectedIds={selectedIds} onSelectSite={onSelectSite} ripple={ripple} els={els} />

      <div className={[g.hud, g.topLeft].join(' ')}>
        <Tabs
          label="Map layer"
          variant="pill"
          value={layer}
          onChange={setLayer}
          items={[
            { id: 'mosaic', label: MOON_TREK_LAYERS.mosaic.label },
            { id: 'relief', label: `${MOON_TREK_LAYERS.relief.label} (LOLA)` },
          ]}
        />
      </div>

      <div className={[g.hud, g.topRight].join(' ')} aria-live="polite">
        {region && (
          <span className={g.glass}>
            <Pill icon="moon" label={REGION_LABEL[region]} title="Region under the cursor" />
          </span>
        )}
      </div>

      <div className={[g.hud, g.bottomBar].join(' ')}>
        <div className={g.bottomLeft}>
          <span ref={coords} className={g.coords} aria-hidden />
          <span className={g.hint}>Drag to turn · Scroll to zoom · Click to drop a pin</span>
        </div>
        <span className={[g.glass, g.bottomRight].join(' ')}>
          {!imageryReady && <Pill icon="clock" label="Loading NASA imagery…" />}
          <Pill icon="beaker" tone="demo" label="Illustrative lighting" title="The Sun direction from the engine is wired in a later step" />
          <Pill icon="layers" label={MOON_TREK_CREDIT} title={MOON_TREK_LAYERS[layer].credit} />
        </span>
      </div>
    </div>
  );
}
