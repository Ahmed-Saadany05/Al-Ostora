// Run: node --test src/scenes/launch/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elongationDeg, moonEcliptic, placeholderOrbit, rocketPath, sunLongitude, EARTH_RADIUS_KM } from './orbit.ts';

test('Sun longitude near the equinoxes and solstices', () => {
  // March equinox 2024-03-20 03:06 UTC → ~0°; June solstice 2024-06-20 20:51 UTC → ~90°.
  const a = sunLongitude('2024-03-20T03:06:00Z');
  assert.ok(a < 0.2 || a > 359.8, `equinox ${a}`);
  assert.ok(Math.abs(sunLongitude('2024-06-20T20:51:00Z') - 90) < 0.2);
});

test('Moon phases: new and full moons of January 2024', () => {
  // New moon 2024-01-11 11:57 UTC, full moon 2024-01-25 17:54 UTC.
  assert.ok(elongationDeg('2024-01-11T11:57:00Z') < 6, 'new moon');
  assert.ok(elongationDeg('2024-01-25T17:54:00Z') > 174, 'full moon');
});

test('Moon distance stays between perigee and apogee', () => {
  for (let i = 0; i < 60; i++) {
    const iso = new Date(Date.UTC(2026, 10, 1) + i * 12 * 3_600_000).toISOString();
    const { distanceKm } = moonEcliptic(iso);
    assert.ok(distanceKm > 355_000 && distanceKm < 407_500, `${iso} ${distanceKm}`);
  }
});

test('placeholder trip starts in Earth parking orbit and ends at the Moon on arrival', () => {
  const launch = '2026-11-13T14:00:00.000Z';
  const arrive = '2026-11-17T08:00:00.000Z';
  const path = rocketPath(placeholderOrbit, launch, arrive, 50);
  const r0 = Math.hypot(...path[0]);
  assert.ok(Math.abs(r0 - (EARTH_RADIUS_KM + 330)) < 1);
  const end = path[path.length - 1];
  const moon = placeholderOrbit.moonAt(arrive);
  assert.ok(Math.hypot(end[0] - moon[0], end[1] - moon[1], end[2] - moon[2]) < 1);
});
