/**
 * MOON TREK GLOBE — the shared lunar sphere used by every globe scene (owner: Pink).
 *
 * NASA Moon Trek WMTS imagery draped on a generated 1,737.4 km sphere with 3d-tiles-renderer:
 *   GeneratedSurfacePlugin   → sphere geometry, tiled like the LRO WAC mosaic, with its imagery
 *   ImageOverlayPlugin       → optional LOLA colour-relief layer on top (Imagery / Relief switch)
 *   TilesFadePlugin          → sharper tiles fade in while you zoom
 *   UpdateOnChangePlugin     → no tile work while nothing moves
 *
 * Render it inside an R3F <Canvas>. One scene unit = one lunar radius; the Moon sits at the origin
 * with north up (+Y). Children are placed in the Moon-fixed frame (+Z north, +X 0° lon) in METRES,
 * so `latLonToVec(lat, lon, MOON_RADIUS_M)` positions things on the surface.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { TilesPlugin, TilesRenderer } from '3d-tiles-renderer/r3f';
import {
  GeneratedSurfacePlugin,
  ImageOverlayPlugin,
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
import { addMoonShading, createMoonLight, shadeLoadedModel } from './moonShading';

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

/** Moon-fixed (Z-up) → scene (Y-up): one fixed turn, applied once, here. */
const BODY_ROTATION = new THREE.Euler(-Math.PI / 2, 0, 0);
const DEFAULT_SUN: Vec3 = { x: 0.82, y: -0.42, z: -0.38 };

export interface MoonTrekGlobeProps {
  /** Which Moon Trek layer to show. */
  layer?: MoonLayerId;
  /** Unit vector towards the Sun in the Moon-fixed frame (see lib/moonFrame azElToDirection). */
  sun?: Vec3;
  /** Called once, when the first full set of imagery tiles has loaded. */
  onImageryReady?: () => void;
  /** Placed in the Moon-fixed frame, in metres. */
  children?: ReactNode;
}

export const MoonTrekGlobe = forwardRef<THREE.Group, MoonTrekGlobeProps>(function MoonTrekGlobe(
  { layer = 'mosaic', sun = DEFAULT_SUN, onImageryReady, children },
  ref,
) {
  const body = useRef<THREE.Group>(null);
  useImperativeHandle(ref, () => body.current as THREE.Group, []);

  const light = useMemo(createMoonLight, []);
  const onLoadModel = useMemo(() => shadeLoadedModel(light), [light]);

  // Overlay instances must stay stable: TilesPlugin re-creates the plugin when its args change.
  const mosaic = useMemo(() => makeOverlay(MOON_TREK_LAYERS.mosaic), []);
  const relief = useMemo(() => makeOverlay(MOON_TREK_LAYERS.relief), []);
  // Plugin args are passed as constructor-argument arrays.
  const surfaceArgs = useMemo(
    () => [{ overlay: mosaic, applyOverlayTexture: true, useRecommendedSettings: false }],
    [mosaic],
  );
  const overlayArgs = useMemo(() => [{ overlays: [] }], []);
  const [overlayPlugin, setOverlayPlugin] = useState<ImageOverlayPlugin | null>(null);
  // The 0.5.4 typings describe the ref as the plugin class; at runtime it is the instance.
  const overlayRef = useCallback((p: unknown) => setOverlayPlugin(p as ImageOverlayPlugin | null), []);
  const reliefShown = useRef(false);

  useEffect(() => {
    light.uMaskOnly.value = layer === 'relief' ? 1 : 0;
    if (!overlayPlugin) return;
    if (layer === 'relief' && !reliefShown.current) overlayPlugin.addOverlay(relief);
    if (layer !== 'relief' && reliefShown.current) overlayPlugin.deleteOverlay(relief);
    reliefShown.current = layer === 'relief';
  }, [layer, overlayPlugin, relief, light]);

  // Placeholder body under the tiles so the globe is never blank while imagery streams in.
  const fallbackMaterial = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color.textFaint) });
    addMoonShading(m, light);
    return m;
  }, [light]);
  useEffect(() => () => fallbackMaterial.dispose(), [fallbackMaterial]);

  const ready = useRef(false);
  const onTilesLoadEnd = () => {
    if (ready.current) return;
    ready.current = true;
    onImageryReady?.();
  };

  const q = useMemo(() => new THREE.Quaternion(), []);
  useFrame(() => {
    const b = body.current;
    if (!b) return;
    b.getWorldPosition(light.uMoonCentre.value);
    b.getWorldQuaternion(q);
    light.uSun.value.set(sun.x, sun.y, sun.z).applyQuaternion(q).normalize();
  });

  return (
    <group ref={body} rotation={BODY_ROTATION} scale={1 / MOON_RADIUS_M}>
      {/* three's sphere is Y-up with u = 0 at −180°: turned so its poles sit on Z like the tiles. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} material={fallbackMaterial} renderOrder={-1}>
        <sphereGeometry args={[MOON_RADIUS_M * 0.998, 128, 64]} />
      </mesh>
      <TilesRenderer errorTarget={1.5} onLoadModel={onLoadModel} onTilesLoadEnd={onTilesLoadEnd}>
        <TilesPlugin plugin={MoonEllipsoidPlugin} />
        <TilesPlugin plugin={GeneratedSurfacePlugin} args={surfaceArgs} />
        <TilesPlugin plugin={ImageOverlayPlugin} args={overlayArgs} ref={overlayRef} />
        <TilesPlugin plugin={TilesFadePlugin} />
        <TilesPlugin plugin={UpdateOnChangePlugin} />
      </TilesRenderer>
      {children}
    </group>
  );
});
