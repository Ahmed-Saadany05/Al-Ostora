/**
 * MOON TREK GLOBE — the shared lunar sphere used by every globe scene (owner: Pink).
 *
 * NASA Moon Trek WMTS imagery draped on a generated 1,737.4 km sphere with 3d-tiles-renderer:
 *   GeneratedSurfacePlugin   → sphere geometry tiled like the layer, textured with its imagery
 *   TilesFadePlugin          → sharper tiles fade in while you zoom
 *   UpdateOnChangePlugin     → no tile work while nothing moves
 *
 * Each layer (Imagery = LRO WAC, Relief = LOLA) is its own generated surface; switching remounts it.
 * (Adding/removing overlays
 * on a live ImageOverlayPlugin is not safe in 3d-tiles-renderer 0.5.4: it throws during streaming
 * and on dispose, so this component never does it.)
 *
 * Render it inside an R3F <Canvas>. One scene unit = one lunar radius; the Moon sits at the origin
 * with north up (+Y). Children are placed in the Moon-fixed frame (+Z north, +X 0° lon) in METRES,
 * so `latLonToVec(lat, lon, MOON_RADIUS_M)` positions things on the surface.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { TilesPlugin, TilesRenderer } from '3d-tiles-renderer/r3f';
import {
  GeneratedSurfacePlugin,
  TilesFadePlugin,
  UpdateOnChangePlugin,
  WMTSTilesOverlay,
} from '3d-tiles-renderer/plugins';
import * as THREE from 'three';
import { color } from '@/shared/theme/tokens';
import { MOON_RADIUS_M, type Vec3 } from '../lib/moonFrame';
import {
  MOON_TREK_LAYERS,
  MOON_TREK_MATRIX_SET,
  MOON_TREK_STYLE,
  wmtsTemplate,
  type MoonLayerId,
  type MoonTrekLayer,
} from '../lib/moonTrek';
import { addMoonShading, createMoonLight, shadeLoadedModel, type MoonLight } from './moonShading';

/** Sizes the library's reference ellipsoid (WGS84 by default) to the Moon before the root loads. */
class MoonEllipsoidPlugin {
  name = 'MOON_ELLIPSOID_PLUGIN';
  priority = -100;
  init(tiles: { ellipsoid: { radius: THREE.Vector3 } }) {
    tiles.ellipsoid.radius.set(MOON_RADIUS_M, MOON_RADIUS_M, MOON_RADIUS_M);
  }
}

function makeOverlay(l: MoonTrekLayer) {
  // Moon Trek's grid is lat/lon (2 × 1 tiles at level 0, from −180°/90°), i.e. EPSG:4326 tiling.
  const options = {
    url: wmtsTemplate(l),
    layer: l.layer,
    tileMatrixSet: MOON_TREK_MATRIX_SET,
    style: MOON_TREK_STYLE,
    format: l.format,
    projection: 'EPSG:4326',
    levels: l.levels,
  };
  // The 0.5.4 typings mark `tileMatrices` as required although the code treats it as optional.
  return new WMTSTilesOverlay(options as unknown as ConstructorParameters<typeof WMTSTilesOverlay>[0]);
}

/** One Moon Trek layer as a streamed, generated sphere. */
function LayerTiles({ layerId, light, onLoaded }: { layerId: MoonLayerId; light: MoonLight; onLoaded: () => void }) {
  const onLoadModel = useMemo(() => shadeLoadedModel(light), [light]);
  // Plugin args are constructor-argument arrays and must stay stable (TilesPlugin re-creates on change).
  const surfaceArgs = useMemo(
    () => [{ overlay: makeOverlay(MOON_TREK_LAYERS[layerId]), applyOverlayTexture: true, useRecommendedSettings: false }],
    [layerId],
  );
  return (
    <TilesRenderer errorTarget={1.5} onLoadModel={onLoadModel} onTilesLoadEnd={onLoaded}>
      <TilesPlugin plugin={MoonEllipsoidPlugin} />
      <TilesPlugin plugin={GeneratedSurfacePlugin} args={surfaceArgs} />
      <TilesPlugin plugin={TilesFadePlugin} />
      <TilesPlugin plugin={UpdateOnChangePlugin} />
    </TilesRenderer>
  );
}

/** Moon-fixed (Z-up) → scene (Y-up): one fixed turn, applied once, here. */
const BODY_ROTATION = new THREE.Euler(-Math.PI / 2, 0, 0);
export const DEFAULT_SUN: Vec3 = { x: 0.82, y: -0.42, z: -0.38 };

export interface MoonTrekGlobeProps {
  /** Which Moon Trek layer to show. */
  layer?: MoonLayerId;
  /** Unit vector towards the Sun in the Moon-fixed frame (see lib/moonFrame azElToDirection). */
  sun?: Vec3;
  /** Called once, when the first full set of imagery tiles has loaded. */
  onImageryReady?: () => void;
  /**
   * Lighting driven by the parent instead of `sun`: the parent writes `uSun` (WORLD-space unit
   * vector) and may fade `uExposure`, e.g. for an intro light sweep. Create it with createMoonLight().
   */
  light?: MoonLight;
  /** Placed in the Moon-fixed frame, in metres. */
  children?: ReactNode;
}

export const MoonTrekGlobe = forwardRef<THREE.Group, MoonTrekGlobeProps>(function MoonTrekGlobe(
  { layer = 'mosaic', sun = DEFAULT_SUN, onImageryReady, light: external, children },
  ref,
) {
  const body = useRef<THREE.Group>(null);
  useImperativeHandle(ref, () => body.current as THREE.Group, []);

  const own = useMemo(createMoonLight, []);
  const light = external ?? own;

  // Switching layers remounts the surface (the grey placeholder sphere shows while new tiles load).
  const ready = useRef(false);
  const onLoaded = () => {
    if (ready.current) return;
    ready.current = true;
    onImageryReady?.();
  };
  useEffect(() => {
    light.uMaskOnly.value = layer === 'relief' ? 1 : 0;
  }, [layer, light]);

  // Placeholder body under the tiles so the globe is never blank while imagery streams in.
  const fallbackMaterial = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color.textFaint) });
    addMoonShading(m, light);
    return m;
  }, [light]);
  useEffect(() => () => fallbackMaterial.dispose(), [fallbackMaterial]);

  const q = useMemo(() => new THREE.Quaternion(), []);
  useFrame(() => {
    const b = body.current;
    if (!b) return;
    b.getWorldPosition(light.uMoonCentre.value);
    if (external) return; // the parent drives uSun
    b.getWorldQuaternion(q);
    light.uSun.value.set(sun.x, sun.y, sun.z).applyQuaternion(q).normalize();
  });

  return (
    <group ref={body} rotation={BODY_ROTATION} scale={1 / MOON_RADIUS_M}>
      {/* three's sphere is Y-up with u = 0 at −180°: turned so its poles sit on Z like the tiles. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} material={fallbackMaterial} renderOrder={-1}>
        <sphereGeometry args={[MOON_RADIUS_M * 0.998, 128, 64]} />
      </mesh>
      <LayerTiles key={layer} layerId={layer} light={light} onLoaded={onLoaded} />
      {children}
    </group>
  );
});
