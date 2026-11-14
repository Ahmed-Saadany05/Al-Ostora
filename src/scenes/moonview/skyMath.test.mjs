// Run: node --test src/scenes/moonview/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { azElToLocal, lightSeconds, localToAzEl, skyPathSegments } from './skyMath.ts';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('az/el → local axes: north is −Z, east is +X, zenith is +Y', () => {
  const n = azElToLocal(0, 0);
  near(n[0], 0); near(n[1], 0); near(n[2], -1);
  const e = azElToLocal(90, 0);
  near(e[0], 1); near(e[1], 0); near(e[2], 0);
  const up = azElToLocal(123, 90);
  near(up[1], 1);
});

test('local → az/el round-trips', () => {
  for (const [az, el] of [[0, 0], [40, 1.6], [352, 4.2], [181, -3], [270, 45]]) {
    const back = localToAzEl(azElToLocal(az, el, 5000));
    near(back.azDeg, az, 1e-9);
    near(back.elDeg, el, 1e-9);
  }
});

test('sky path drops below-horizon stretches and splits segments there', () => {
  const samples = [
    { azDeg: 80, elDeg: 1 }, { azDeg: 90, elDeg: 2 }, { azDeg: 100, elDeg: 1 },
    { azDeg: 110, elDeg: -5 }, { azDeg: 120, elDeg: -6 },
    { azDeg: 130, elDeg: 0.5 }, { azDeg: 140, elDeg: 1.5 },
  ];
  const segs = skyPathSegments(samples, 100);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].length, 3);
  assert.equal(segs[1].length, 2);
});

test('light time: Earth ≈ 1.3 s, Sun ≈ 8.3 min', () => {
  near(lightSeconds(384_400), 1.282, 0.001);
  near(lightSeconds(149_600_000) / 60, 8.317, 0.01);
});

import { interpolateSky, lerpAzDeg } from './skyMath.ts';

const body = (az, el) => ({ azDeg: az, elDeg: el, horizonElDeg: 0, clearanceDeg: el, distanceKm: 100, angularDiameterDeg: 0.5, visibleFraction: 1 });
const sample = (iso, sunAz, sunEl, sunVisible) => ({
  time: iso,
  sun: body(sunAz, sunEl),
  earth: { ...body(10, 5), illumination: 0.5 },
  sunVisible,
  earthVisible: true,
});

test('azimuth blends the short way round', () => {
  near(lerpAzDeg(350, 10, 0.5), 0);
  near(lerpAzDeg(10, 350, 0.25), 5);
  near(lerpAzDeg(90, 180, 0.5), 135);
});

test('interpolateSky blends between samples and keeps the data layer’s visibility', () => {
  const s = [sample('2026-11-13T00:00:00.000Z', 100, 1, true), sample('2026-11-13T01:00:00.000Z', 110, -1, false)];
  const mid = interpolateSky(s, '2026-11-13T00:30:00.000Z');
  near(mid.sun.azDeg, 105);
  near(mid.sun.elDeg, 0);
  assert.equal(mid.time, '2026-11-13T00:30:00.000Z');
  assert.equal(interpolateSky(s, '2026-11-13T00:10:00.000Z').sunVisible, true);
  assert.equal(interpolateSky(s, '2026-11-13T00:50:00.000Z').sunVisible, false);
  assert.equal(interpolateSky(s, '2026-11-14T00:00:00.000Z'), null);
  assert.equal(interpolateSky(undefined, '2026-11-13T00:30:00.000Z'), null);
  near(interpolateSky(s, '2026-11-13T01:00:00.000Z').sun.azDeg, 110);
});
