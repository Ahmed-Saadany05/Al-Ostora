// Run: node --test src/scenes/lib/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOON_TREK_LAYERS, tileGrid, tileUrl, wmtsTemplate } from './moonTrek.ts';

test('tile URL matches the WMTS REST template Moon Trek publishes', () => {
  assert.equal(
    tileUrl(MOON_TREK_LAYERS.mosaic, 0, 0, 0),
    'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/0/0/0.jpg',
  );
  assert.ok(tileUrl(MOON_TREK_LAYERS.relief, 3, 2, 5).endsWith('/LRO_LOLA_ClrShade_Global_128ppd_v04/1.0.0/default/default028mm/3/2/5.png'));
  assert.ok(wmtsTemplate(MOON_TREK_LAYERS.mosaic).endsWith('/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg'));
});

test('levels match the capabilities (WAC 0–8, LOLA 0–5) and the grid is 2×1 at level 0', () => {
  assert.equal(MOON_TREK_LAYERS.mosaic.levels, 9);
  assert.equal(MOON_TREK_LAYERS.relief.levels, 6);
  assert.deepEqual(tileGrid(0), { cols: 2, rows: 1 });
  assert.deepEqual(tileGrid(8), { cols: 512, rows: 256 });
});
