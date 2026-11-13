// Run: node --test src/scenes/moonview/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { azimuthOf, siteTerrain, skylineAt } from './terrain.ts';

const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('azimuth of ground points: north is −z, east is +x', () => {
  near(azimuthOf(0, -10), 0, 1e-9);
  near(azimuthOf(10, 0), 90, 1e-9);
  near(azimuthOf(0, 10), 180, 1e-9);
  near(azimuthOf(-10, 0), 270, 1e-9);
});

test('skyline interpolates and wraps at 360°', () => {
  const h = { azStepDeg: 90, elevationsDeg: [0, 4, 8, 4] };
  near(skylineAt(h, 45), 2, 1e-9);
  near(skylineAt(h, 315), 2, 1e-9);
  near(skylineAt(h, 360), 0, 1e-9);
});

test('the terrain edge sits at the measured skyline elevation in every direction', () => {
  // A made-up profile: a peak (−3°) to the north, a crater wall (+4°) to the south.
  const elevationsDeg = Array.from({ length: 720 }, (_, i) => -3 + 7 * (1 - Math.cos((i * 0.5 * Math.PI) / 180)) / 2);
  const horizon = { azStepDeg: 0.5, elevationsDeg, observerHeightM: 2 };
  const t = siteTerrain(7, horizon, { craters: false });
  const eye = t.heightAt(0, 0) + 2;
  const edge = t.radius * 0.9;
  for (const az of [0, 60, 135, 180, 250, 330]) {
    const a = (az * Math.PI) / 180;
    const x = Math.sin(a) * edge;
    const z = -Math.cos(a) * edge;
    const angle = (Math.atan2(t.heightAt(x, z) - eye, edge) * 180) / Math.PI;
    near(angle, skylineAt(horizon, az), 0.35);
  }
});

test('the ground under the lander is level', () => {
  const horizon = { azStepDeg: 0.5, elevationsDeg: Array(720).fill(2), observerHeightM: 2 };
  const t = siteTerrain(3, horizon);
  near(t.heightAt(0, 0), 0, 1e-9);
  near(t.heightAt(5, -5), 0, 0.5);
});
