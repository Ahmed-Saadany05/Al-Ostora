/**
 * NASA MOON TREK imagery layers (NASA JPL, trek.nasa.gov) used on the globe.
 *
 * Verified 13 Nov 2026: tiles are open to any website (Access-Control-Allow-Origin: *, no token).
 * Global layers are WMTS in a lat/lon grid that matches EPSG:4326 tiling: 256 px tiles,
 * 2 × 1 tiles at level 0, top-left corner at −180° / 90°.
 *
 * Hagras picks the final layer IDs (board task "Moon Trek layers"); change them here only.
 */

export type MoonLayerId = 'mosaic' | 'relief';

export interface MoonTrekLayer {
  id: MoonLayerId;
  /** Short UI label. */
  label: string;
  /** What it shows, for tooltips and credits. */
  description: string;
  /** Moon Trek layer identifier. */
  layer: string;
  format: 'image/jpeg' | 'image/png';
  /** Tile matrices published for the layer (levels 0 … levels − 1). Never request deeper. */
  levels: number;
  credit: string;
  /** WMTSCapabilities document — the source to cite. */
  capabilities: string;
}

export const MOON_TREK_ROOT = 'https://trek.nasa.gov/tiles/Moon/EQ';
export const MOON_TREK_MATRIX_SET = 'default028mm';
export const MOON_TREK_STYLE = 'default';

const capabilities = (layer: string) => `${MOON_TREK_ROOT}/${layer}/1.0.0/WMTSCapabilities.xml`;

export const MOON_TREK_LAYERS: Record<MoonLayerId, MoonTrekLayer> = {
  mosaic: {
    id: 'mosaic',
    label: 'Imagery',
    description: 'LRO Wide Angle Camera global mosaic (303 px/°)',
    layer: 'LRO_WAC_Mosaic_Global_303ppd_v02',
    format: 'image/jpeg',
    levels: 9,
    credit: 'NASA Moon Trek / LRO WAC (NASA/GSFC/Arizona State University)',
    capabilities: capabilities('LRO_WAC_Mosaic_Global_303ppd_v02'),
  },
  relief: {
    id: 'relief',
    label: 'Relief',
    description: 'LOLA colour shaded relief — elevation as colour (128 px/°)',
    layer: 'LRO_LOLA_ClrShade_Global_128ppd_v04',
    format: 'image/png',
    levels: 6,
    credit: 'NASA Moon Trek / LRO LOLA (NASA/GSFC)',
    capabilities: capabilities('LRO_LOLA_ClrShade_Global_128ppd_v04'),
  },
};

/**
 * South-polar (polar stereographic) layer for close views of the pole — the global grid
 * stretches near ±90°. Not chosen yet (Hagras): stays null until a layer ID is confirmed.
 */
export const MOON_TREK_SOUTH_POLAR: { layer: string; root: string } | null = null;

/** The short on-globe credit line required for every view that shows Moon Trek imagery. */
export const MOON_TREK_CREDIT = 'NASA Moon Trek / LRO';

const extension = (l: MoonTrekLayer) => (l.format === 'image/png' ? 'png' : 'jpg');

/** RESTful WMTS template for 3d-tiles-renderer's WMTSTilesOverlay ({TileMatrix}/{TileRow}/{TileCol}). */
export function wmtsTemplate(l: MoonTrekLayer, root = MOON_TREK_ROOT): string {
  return `${root}/${l.layer}/1.0.0/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.${extension(l)}`;
}

/** One concrete tile URL (level, row from the top, column from −180°). */
export function tileUrl(l: MoonTrekLayer, level: number, row: number, col: number, root = MOON_TREK_ROOT): string {
  return `${root}/${l.layer}/1.0.0/${MOON_TREK_STYLE}/${MOON_TREK_MATRIX_SET}/${level}/${row}/${col}.${extension(l)}`;
}

/** Tiles across × down at a level (2 × 1 at level 0, doubling each level). */
export function tileGrid(level: number): { cols: number; rows: number } {
  return { cols: 2 ** (level + 1), rows: 2 ** level };
}
