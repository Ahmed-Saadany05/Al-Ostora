// Unit tests for the Moon-fixed frame. Run: node --test src/scenes/lib/
// Plain .mjs on purpose: Node strips the types from the .ts module it imports, and tsc
// (which forbids `.ts` import extensions) does not type-check .mjs files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOON_RADIUS_M,
  azElToDirection,
  intersectSphere,
  latLonToVec,
  normalizeLon,
  pickLatLon,
  regionAt,
  regionOutline,
  roundCoord,
  vecToLatLon,
} from './moonFrame.ts';

const near = (a, b, eps = 1e-9, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} ≉ ${b}`);
const nearVec = (a, b, eps = 1e-9) => {
  near(a.x, b.x, eps, 'x');
  near(a.y, b.y, eps, 'y');
  near(a.z, b.z, eps, 'z');
};

test('axes: 0°/0° is +X, 90° E is +Y, north pole is +Z', () => {
  nearVec(latLonToVec(0, 0), { x: 1, y: 0, z: 0 });
  nearVec(latLonToVec(0, 90), { x: 0, y: 1, z: 0 });
  nearVec(latLonToVec(90, 0), { x: 0, y: 0, z: 1 });
  nearVec(latLonToVec(-90, 0, 2), { x: 0, y: 0, z: -2 });
});

test('lat/lon round-trips through a vector', () => {
  for (const [lat, lon] of [[-89.67, 129.78], [-86, -2.9], [0.6741, 23.4733], [45, -179.5], [-12.3456, 179.999]]) {
    const back = vecToLatLon(latLonToVec(lat, lon, MOON_RADIUS_M));
    near(back.lat, lat, 1e-9);
    near(back.lon, lon, 1e-9);
  }
});

test('normalizeLon and roundCoord', () => {
  assert.equal(normalizeLon(190), -170);
  assert.equal(normalizeLon(-190), 170);
  assert.equal(normalizeLon(180), 180);
  assert.equal(normalizeLon(540), 180);
  assert.equal(roundCoord(-0.00001), 0);
  assert.equal(roundCoord(129.78004), 129.78);
});

test('ray–sphere: a ray from +X towards the centre hits 0°/0°; a miss returns null', () => {
  const hit = intersectSphere({ x: 3, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, 1);
  nearVec(hit, { x: 1, y: 0, z: 0 });
  assert.equal(intersectSphere({ x: 3, y: 2, z: 0 }, { x: -1, y: 0, z: 0 }, 1), null);
  assert.equal(intersectSphere({ x: 3, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1), null, 'pointing away');
});

test('pick round-trip: aiming at a known site from orbit returns that site (≤ 1e-4°)', () => {
  const R = MOON_RADIUS_M;
  for (const [lat, lon] of [[-89.67, 129.78], [-86, -2.9], [-84.5, 37.8], [0.6741, 23.4733], [20, -150]]) {
    const target = latLonToVec(lat, lon, R);
    // Camera at 3 R, offset from the site's zenith, looking at the site (oblique view).
    const camera = latLonToVec(lat * 0.8, lon + 15, 3 * R);
    const dir = { x: target.x - camera.x, y: target.y - camera.y, z: target.z - camera.z };
    const got = pickLatLon(camera, dir, R);
    assert.ok(got, 'should hit');
    near(got.lat, lat, 1e-4, 'lat');
    near(got.lon, lon, 1e-4, 'lon');
  }
});

test('az/el → direction at 0°/0°: N is +Z, E is +Y, zenith is +X', () => {
  const site = { lat: 0, lon: 0 };
  nearVec(azElToDirection(site, 0, 0), { x: 0, y: 0, z: 1 });
  nearVec(azElToDirection(site, 90, 0), { x: 0, y: 1, z: 0 });
  nearVec(azElToDirection(site, 0, 90), { x: 1, y: 0, z: 0 });
});

test('az/el → direction is a unit vector, and the same Sun seen from two sites agrees', () => {
  // The Sun on the horizon due east of 0°/0° is the direction +Y. From 0°N 90°E that same
  // direction is straight overhead (elevation 90°).
  nearVec(azElToDirection({ lat: 0, lon: 90 }, 0, 90), { x: 0, y: 1, z: 0 });
  const d = azElToDirection({ lat: -89.67, lon: 129.78 }, 211.4, 1.2);
  near(Math.hypot(d.x, d.y, d.z), 1, 1e-12);
});

test('regions mirror customSite(): ±80° caps, far side beyond ±90° longitude', () => {
  assert.equal(regionAt(-89.67, 129.78), 'south-pole');
  assert.equal(regionAt(-80, 0), 'nearside');
  assert.equal(regionAt(-80.01, 0), 'south-pole');
  assert.equal(regionAt(85, 10), 'north-pole');
  assert.equal(regionAt(10, 120), 'farside');
  assert.equal(regionAt(10, -90), 'nearside');
  assert.equal(regionAt(10, -90.5), 'farside');
  for (const id of ['south-pole', 'north-pole', 'nearside', 'farside']) {
    const lines = regionOutline(id);
    assert.ok(lines.length > 0 && lines.every((l) => l.length > 2), id);
  }
});
