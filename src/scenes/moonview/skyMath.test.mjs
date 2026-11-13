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
