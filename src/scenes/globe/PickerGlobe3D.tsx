/**
 * The 3D part of SitePickerGlobe (owner: Pink), loaded lazily so three.js and the tile renderer
 * only download on step 1. Board tasks "Moon Trek globe" + "Regions globe".
 *
 * NASA Moon Trek imagery on a 3D Moon: drag to turn, scroll to zoom. The parent (SitePickerGlobe)
 * owns the flow: which sector glows, where the camera goes, which pin is lit. This file draws it
 * and reports Moon hovers/clicks back. Regions follow `customSite()` in @/shared/mission.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { formatLatLon } from '@/shared/format';
import { color } from '@/shared/theme/tokens';
import { useApp } from '@/shared/store/app';
import type { Site } from '@/shared/types';
import { Tabs } from '@/shared/ui';
import { DEFAULT_SUN, MoonTrekGlobe } from './MoonTrekGlobe';
import { createMoonLight } from './moonShading';
import { RegionGlow } from './RegionGlow';
import { FIT_DISTANCE, KIND_WORD, OPENING_VIEW, STEP1_NIGHT_FLOOR, openingDistance, PICKER_FOV, START_DISTANCE, type CameraGoal, type PickerGlobe3DProps } from './pickerTypes';
import {
  MOON_RADIUS_M,
  latLonToVec,
  pickLatLon,
  vecToLatLon,
  regionAt,
  regionOutline,
  type LatLon,
  type RegionId,
  type Vec3,
} from '../lib/moonFrame';
import { MOON_TREK_CREDIT, MOON_TREK_LAYERS, type MoonLayerId } from '../lib/moonTrek';
import { rememberPickerStage } from './moonHandoff';
import g from './globe.module.css';

// ---------------------------------------------------------------- helpers

/** Moon-fixed (Z-up) vector → scene (Y-up), the same turn MoonTrekGlobe applies to its body. */
const toScene = (v: Vec3) => new THREE.Vector3(v.x, v.z, -v.y);
/** Opening view: above the last selected site, else from 55° S so the south pole (the challenge focus) and near side show. */
const startPosition = (site?: Site) =>
  toScene(site ? latLonToVec(THREE.MathUtils.clamp(site.lat, -75, 75), site.lon, START_DISTANCE) : latLonToVec(OPENING_VIEW.lat, OPENING_VIEW.lon, START_DISTANCE));
const MIN_DISTANCE = 1.025; // ≈ 43 km above the surface
const MAX_DISTANCE = 12;
const LABELS_BELOW_DISTANCE = 1.6;
/** Up to this many pins in a sector, their names are always shown. */
const LABELS_ALWAYS_MAX = 6;
const CLICK_SLOP_PX = 5;

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
            opacity={id === hovered ? 0.55 : 0.14}
            lineWidth={1}
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
  hotSiteId,
  onSelectSite,
  ripple,
  els,
}: {
  sites: Site[];
  selectedIds: string[];
  hotSiteId: string | null;
  onSelectSite: (id: string) => void;
  ripple: (LatLon & { key: number }) | null;
  els: AnchorEls;
}) {
  const bind = (id: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };
  return (
    // Few sites: names always shown next to the letters (as in the design); many: on hover/selection.
    <div className={[g.anchors, sites.length <= LABELS_ALWAYS_MAX && g.alwaysLabels].filter(Boolean).join(' ')}>
      {sites.map((site) => {
        const selected = selectedIds.includes(site.id);
        return (
          <div key={site.id} ref={bind(site.id)} className={g.anchor} data-hidden="true">
            <button
              type="button"
              className={[g.marker, selected && g.selected, site.id === hotSiteId && g.hot].filter(Boolean).join(' ')}
              onClick={() => onSelectSite(site.id)}
              aria-pressed={selected}
              title={`${site.name} · ${KIND_WORD[site.kind]} · ${formatLatLon(site.lat, site.lon)}`}
            >
              <span className={g.dot} />
              <span className={g.label}>{site.kind === 'custom' ? formatLatLon(site.lat, site.lon, 2) : site.name}</span>
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

/**
 * Moves the camera to a goal (instant when motion is off). The path is interpolated in latitude and
 * longitude rather than along the great circle: a great-circle path from the far side to a pole
 * passes over the pole itself, where the orbit controls' spherical coordinates break down and the
 * view twists. Distance eases on a log scale. Orbit controls are paused during the move.
 */
function CameraDirector({ goal, motion }: { goal: CameraGoal | null; motion: boolean }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const controls = useThree((s) => s.controls) as unknown as { update: () => void; enabled: boolean } | null;

  // Opening distance fitted to this box (narrow boxes step back so the whole Moon shows).
  useEffect(() => {
    camera.position.setLength(openingDistance(size.width, size.height));
    controls?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const flight = useRef<{ lat0: number; lon0: number; dLat: number; dLon: number; d0: number; d1: number; t: number; seconds: number } | null>(null);

  const place = (lat: number, lon: number, d: number) => camera.position.copy(toScene(latLonToVec(lat, lon, d)));

  useEffect(() => {
    if (!goal) return;
    const p = camera.position;
    const from = vecToLatLon({ x: p.x, y: -p.z, z: p.y }); // scene → Moon-fixed
    const d0 = p.length();
    const box = sizeRef.current;
    const d1 = goal.distance === FIT_DISTANCE ? openingDistance(box.width, box.height) : (goal.distance ?? d0);
    const lat1 = THREE.MathUtils.clamp(goal.lat, -89.5, 89.5);
    const dLat = lat1 - from.lat;
    const dLon = ((((goal.lon - from.lon) % 360) + 540) % 360) - 180; // shortest way round
    if (!motion) {
      place(lat1, goal.lon, d1);
      controls?.update();
      return;
    }
    const turn = THREE.MathUtils.degToRad(Math.hypot(dLat, dLon * Math.cos(THREE.MathUtils.degToRad((from.lat + lat1) / 2))));
    const seconds = THREE.MathUtils.clamp(0.7 + turn * 0.35 + Math.abs(Math.log(d1 / d0)) * 0.35, 0.7, 1.6);
    flight.current = { lat0: from.lat, lon0: from.lon, dLat, dLon, d0, d1, t: 0, seconds };
    if (controls) controls.enabled = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, camera, controls, motion]);

  useFrame((_, dt) => {
    const f = flight.current;
    if (!f) return;
    f.t = Math.min(1, f.t + Math.min(dt, 0.05) / f.seconds);
    const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
    place(f.lat0 + f.dLat * e, f.lon0 + f.dLon * e, f.d0 * Math.pow(f.d1 / f.d0, e));
    camera.lookAt(0, 0, 0);
    if (f.t >= 1) {
      flight.current = null;
      if (controls) {
        controls.enabled = true;
        controls.update();
      }
    }
  });
  return null;
}

interface SceneProps {
  layer: MoonLayerId;
  motion: boolean;
  goal: CameraGoal | null;
  hoverRegion: RegionId | null;
  activeRegion: RegionId | null;
  anchors: Anchor[];
  els: AnchorEls;
  onMoonHoverRegion: (r: RegionId | null) => void;
  onMoonClick: (p: LatLon) => void;
  onImageryReady?: () => void;
}

function Scene({ layer, motion, goal, hoverRegion, activeRegion, anchors, els, onMoonHoverRegion, onMoonClick, onImageryReady }: SceneProps) {
  const body = useRef<THREE.Group>(null);
  const moonHover = useRef<RegionId | null>(null);
  // A fixed Sun on the Moon (one side in shadow, turning with it), with the night side lifted so its
  // big features stay visible.
  const light = useMemo(() => {
    const l = createMoonLight();
    l.uNightFloor.value = STEP1_NIGHT_FLOOR;
    return l;
  }, []);
  const bodyQ = useMemo(() => new THREE.Quaternion(), []);
  useFrame(() => {
    const b = body.current;
    if (!b) return;
    b.getWorldQuaternion(bodyQ);
    light.uSun.value.set(DEFAULT_SUN.x, DEFAULT_SUN.y, DEFAULT_SUN.z).applyQuaternion(bodyQ).normalize();
  });
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

  const report = (r: RegionId | null) => {
    if (r === moonHover.current) return;
    moonHover.current = r;
    onMoonHoverRegion(r);
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    const p = surfaceAt(e);
    report(p ? regionAt(p.lat, p.lon) : null);
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > CLICK_SLOP_PX) return; // that was a drag
    const p = surfaceAt(e);
    if (p) onMoonClick(p);
  };

  return (
    <>
      <MoonTrekGlobe ref={body} layer={layer} light={light} onImageryReady={onImageryReady}>
        <RegionGlow hover={hoverRegion} active={activeRegion} motion={motion} />
        <RegionOutlines hovered={hoverRegion} />
        <ScreenAnchors anchors={anchors} els={els} />
      </MoonTrekGlobe>
      {/* Invisible hit sphere: the exact pick is analytic (pickLatLon), so it works while tiles stream. */}
      <mesh onPointerMove={move} onPointerOut={() => report(null)} onClick={click}>
        <sphereGeometry args={[1, 96, 64]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
      <AltitudeAwareControls motion={motion} />
      <CameraDirector goal={goal} motion={motion} />
    </>
  );
}

// ---------------------------------------------------------------- component

export default function PickerGlobe3D({
  sites,
  selectedIds,
  onSelectSite,
  hoverRegion,
  activeRegion,
  hotSiteId,
  goal,
  ripple,
  onMoonHoverRegion,
  onMoonClick,
  fromHome,
  onImageryReady,
}: PickerGlobe3DProps) {
  const motion = useApp((s) => s.motion);
  const [layer, setLayer] = useState<MoonLayerId>('mosaic');
  // From Home the flight already happened there: open exactly on the opening view it landed on.
  const [start] = useState(() => startPosition(fromHome ? undefined : sites.find((x) => x.id === selectedIds[selectedIds.length - 1])));
  const els = useRef(new Map<string, HTMLElement>());
  // Tell the Home flight where this Moon really sits, so the next flight lands on it exactly.
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const save = () => {
      const r = el.getBoundingClientRect();
      rememberPickerStage({ left: r.left, top: r.top + scrollY, width: r.width, height: r.height });
    };
    save();
    const ro = new ResizeObserver(save);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Pins appear only once a sector is chosen, and only that sector's sites.
  const shownSites = useMemo(() => (activeRegion ? sites.filter((x) => x.region === activeRegion) : []), [sites, activeRegion]);
  const anchors = useMemo<Anchor[]>(
    () => [...shownSites.map(({ id, lat, lon }) => ({ id, lat, lon })), ...(ripple ? [{ id: RIPPLE_ID, lat: ripple.lat, lon: ripple.lon }] : [])],
    [shownSites, ripple],
  );

  return (
    <div
      ref={stage}
      className={g.stage}
      data-globe
      role="application"
      aria-label="3D Moon. Drag to turn, scroll to zoom. Choose a sector, then a site, or click the Moon to drop a pin at those coordinates."
    >
      <Canvas camera={{ fov: PICKER_FOV, near: 0.002, far: 40, position: start }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
        <Scene
          layer={layer}
          motion={motion}
          goal={goal}
          hoverRegion={hoverRegion}
          activeRegion={activeRegion}
          anchors={anchors}
          els={els}
          onMoonHoverRegion={onMoonHoverRegion}
          onMoonClick={onMoonClick}
          onImageryReady={onImageryReady}
        />
      </Canvas>
      <MarkerLayer sites={shownSites} selectedIds={selectedIds} hotSiteId={hotSiteId} onSelectSite={onSelectSite} ripple={ripple} els={els} />

      <div className={[g.hud, g.bottomLeftHud].join(' ')}>
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
      <span className={g.credit} title={MOON_TREK_LAYERS[layer].credit}>
        {MOON_TREK_CREDIT}
      </span>
    </div>
  );
}
