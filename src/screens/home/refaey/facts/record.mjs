// Records the Horizons facts Refaey's stories stand on. Run: node src/screens/home/refaey/facts/record.mjs
// Calls the repo's own proxy handler (api/_lib/horizons-handler.ts, read-only) with the same parameters the app uses, so every
// number here is a JPL Horizons answer. Writes facts.json next to this file. If Horizons cannot be reached it stops: nothing is estimated.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { handleHorizons } from '../../../../../api/_lib/horizons-handler.ts';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const root = (p) => here('../../../../../' + p);

/** Site id + coordinates straight from the catalogue (read as text: the file imports app code). */
const catalogue = readFileSync(root('src/data/sites/catalogue.ts'), 'utf8');
function site(id) {
  const m = new RegExp(`id: '${id}',[\\s\\S]*?lat: (-?[\\d.]+),\\s*lon: (-?[\\d.]+)`).exec(catalogue);
  if (!m) throw new Error(`site ${id} is not in the catalogue`);
  return { id, lat: Number(m[1]), lon: Number(m[2]) };
}

async function horizons(target, s, start, stop, step) {
  const qs = new URLSearchParams({ target, lat: String(s.lat), lon: String(s.lon), altKm: '0', start, stop, step });
  const res = await handleHorizons(new Request(`http://local/api/horizons?${qs}`));
  const body = await res.json();
  if (!res.ok || body.source !== 'horizons') throw new Error(`Horizons failed for ${target} at ${s.id}: ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  return body; // { rows: [{time, azDeg, elDeg, angularDiameterDeg, distanceKm}], horizonsUrl }
}

const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
const plusMin = (t, m) => iso(Date.parse(t) + m * 60_000);
/** One row at (the minute of) `t`. Horizons' resolution here is a minute: the Sun moves ~0.0083° per minute, far below what we display. */
async function at(target, s, t) {
  const b = await horizons(target, s, t, plusMin(t, 2), '1m');
  return { row: b.rows[0], horizonsUrl: b.horizonsUrl };
}

const R_KM = 1737.4; // same sphere as the engine (LUNAR.radiusKm)
const dipDeg = (Math.acos(R_KM / (R_KM + 0.002)) * 180) / Math.PI; // 2 m observer, as src/engine/horizon.ts
const retrieved = new Date().toISOString().slice(0, 10);

const fact = (key, value, unit, time, s, extra) => ({ key, value, unit, time, siteId: s.id, lat: s.lat, lon: s.lon, ...extra });
const facts = [];
const checks = [];

// ---- Apollo 11, 12, 16, 17: Sun and Earth elevation at touchdown (times and the check values come from the engine's fixture file; read with fs, not imported)
const fixture = JSON.parse(readFileSync(root('src/engine/__tests__/fixtures/apollo_landings.json'), 'utf8'));
for (const [mission, id, n] of [['Apollo11', 'apollo-11', 'a11'], ['Apollo12', 'apollo-12', 'a12'], ['Apollo16', 'apollo-16', 'a16'], ['Apollo17', 'apollo-17', 'a17']]) {
  const s = site(id);
  const rows = fixture.rows.filter((r) => r.mission === mission);
  const t = rows[0].time;
  for (const target of ['sun', 'earth']) {
    const { row, horizonsUrl } = await at(target, s, t);
    const f = fact(`${n}${target === 'sun' ? 'Sun' : 'Earth'}`, Number(row.elDeg.toFixed(2)), 'deg', t, s, { target, azDeg: Number(row.azDeg.toFixed(2)), horizonsUrl, recordedRowTime: row.time });
    facts.push(f);
    const expected = rows.find((r) => r.target === target).elDeg;
    checks.push({ key: f.key, recorded: f.value, fixture: expected, diff: Number(Math.abs(row.elDeg - expected).toFixed(3)), ok: Math.abs(row.elDeg - expected) <= 0.05 });
  }
  // the catalogue point is the LROC one the fixture used
  const fr = rows[0];
  checks.push({ key: `${n}Site`, ok: Math.abs(fr.lat - s.lat) < 1e-3 && Math.abs(fr.lon - s.lon) < 1e-3, catalogue: [s.lat, s.lon], fixture: [fr.lat, fr.lon] });
}

// ---- Chang'e 4
{
  const s = site('change-4');
  const t = '2019-01-03T02:26:00Z'; // CNSA landing time; Guinness World Records page: "02:26 (UTC) on 3 January 2019"
  const sunNow = await at('sun', s, t);
  const earthNow = await at('earth', s, t);
  facts.push(fact('ce4Sun', Number(sunNow.row.elDeg.toFixed(2)), 'deg', t, s, { target: 'sun', azDeg: Number(sunNow.row.azDeg.toFixed(2)), horizonsUrl: sunNow.horizonsUrl }));
  facts.push(fact('ce4Earth', Number(earthNow.row.elDeg.toFixed(2)), 'deg', t, s, { target: 'earth', azDeg: Number(earthNow.row.azDeg.toFixed(2)), horizonsUrl: earthNow.horizonsUrl }));
  // hourly rows 25 Dec 2018 → 16 Jan 2019 (flat horizon: the engine's flat profile is the 2 m dip below 0°)
  const start = '2018-12-25T00:00:00Z';
  const stop = '2019-01-16T00:00:00Z';
  const sun = await horizons('sun', s, start, stop, '1h');
  const earth = await horizons('earth', s, start, stop, '1h');
  const up = (r) => r.elDeg + dipDeg + r.angularDiameterDeg / 2; // > 0 means any part of the disk is above the flat horizon (the engine's rule)
  const T = Date.parse(t);
  const rows = sun.rows;
  let i = rows.findIndex((r) => Date.parse(r.time) > T) - 1; // last row at or before touchdown
  if (i < 1) throw new Error('touchdown is outside the recorded rows');
  const cross = (a, b) => Date.parse(a.time) + ((0 - up(a)) / (up(b) - up(a))) * (Date.parse(b.time) - Date.parse(a.time));
  let j = i;
  while (j > 0 && up(rows[j]) > 0) j--; // walk back to the last row with the Sun down
  if (j === 0 && up(rows[0]) > 0) throw new Error('no sunrise before touchdown inside the recorded rows: widen the range');
  const sunrise = cross(rows[j], rows[j + 1]);
  let k = i + 1;
  while (k < rows.length && up(rows[k]) > 0) k++;
  if (k >= rows.length) throw new Error('no sunset after touchdown inside the recorded rows: widen the range');
  const sunset = cross(rows[k - 1], rows[k]);
  facts.push(fact('ce4HoursSinceSunrise', Number(((T - sunrise) / 3.6e6).toFixed(1)), 'h', t, s, { derivedFrom: 'hourly Horizons Sun rows', sunrise: iso(sunrise), horizonsUrl: sun.horizonsUrl, rule: 'upper limb above the flat horizon (engine rule), linear interpolation between hourly rows' }));
  facts.push(fact('ce4HoursToSunset', Number(((sunset - T) / 3.6e6).toFixed(1)), 'h', t, s, { derivedFrom: 'hourly Horizons Sun rows', sunset: iso(sunset), horizonsUrl: sun.horizonsUrl, rule: 'same' }));
  facts.push(fact('ce4EarthMaxElevation', Number(Math.max(...earth.rows.map((r) => r.elDeg)).toFixed(2)), 'deg', `${start}/${stop}`, s, { derivedFrom: 'hourly Horizons Earth rows', horizonsUrl: earth.horizonsUrl, rows: earth.rows.length }));
}

// ---- Athena (IM-2)
{
  const s = site('im-2-athena');
  // About 17:30 UTC: NASA PRIME-1 page "approximately 11:30 a.m. March 6, 2025" (NASA blog: CST), Space Flight Now / SpacePolicyOnline "12:30 pm ET".
  const t = '2025-03-06T17:30:00Z';
  const sun = await at('sun', s, t);
  const earth = await at('earth', s, t);
  facts.push(fact('athenaSun', Number(sun.row.elDeg.toFixed(2)), 'deg', t, s, { target: 'sun', azDeg: Number(sun.row.azDeg.toFixed(2)), horizonsUrl: sun.horizonsUrl }));
  facts.push(fact('athenaEarth', Number(earth.row.elDeg.toFixed(2)), 'deg', t, s, { target: 'earth', azDeg: Number(earth.row.azDeg.toFixed(2)), horizonsUrl: earth.horizonsUrl }));
  // The engine's own verdict from the LOLA profile (formulas mirror src/engine/visibility.ts: linear skyline, upper limb vs skyline).
  const prof = JSON.parse(readFileSync(root('src/data/horizons-lola/im-2-athena.json'), 'utf8'));
  const n = prof.elevationsDeg.length;
  const x = (((sun.row.azDeg % 360) + 360) % 360) / prof.azStepDeg;
  const a = Math.floor(x) % n;
  const f = x - Math.floor(x);
  const skyline = prof.elevationsDeg[a] * (1 - f) + prof.elevationsDeg[(a + 1) % n] * f;
  const r = sun.row.angularDiameterDeg / 2;
  const clearance = sun.row.elDeg - skyline;
  const sunlit = clearance + r > 0;
  const near = prof.dem.layers.find((l) => l.fromKm === 0);
  facts.push(fact('athenaSkylineAtSun', Number(skyline.toFixed(2)), 'deg', t, s, { derivedFrom: 'src/data/horizons-lola/im-2-athena.json at the Sun azimuth', azDeg: Number(sun.row.azDeg.toFixed(2)) }));
  facts.push(fact('athenaSunClearance', Number(clearance.toFixed(2)), 'deg', t, s, { derivedFrom: 'Sun centre elevation minus skyline elevation' }));
  facts.push(fact('athenaVerdict', sunlit ? 'sunlit' : 'hidden', 'verdict', t, s, { rule: 'any part of the Sun disk above the LOLA skyline (engine rule)', sunRadiusDeg: Number(r.toFixed(3)) }));
  facts.push(fact('athenaDemResM', near.resolutionM, 'm', t, s, { derivedFrom: `src/data/horizons-lola/im-2-athena.json dem.layers[0] (${near.product}, 0–${near.toKm} km)` }));
}

const bad = checks.filter((c) => !c.ok);
const out = { retrieved, source: 'JPL Horizons via the repo proxy (api/_lib/horizons-handler.ts)', facts, checks };
writeFileSync(here('./facts.json'), JSON.stringify(out, null, 2) + '\n');
console.log(facts.map((f) => `${f.key.padEnd(22)} ${String(f.value).padStart(8)} ${f.unit}  ${f.time}`).join('\n'));
console.log('\nchecks:', checks.map((c) => `${c.key}:${c.ok ? 'ok' : 'FAIL'}${c.diff !== undefined ? '(' + c.diff + ')' : ''}`).join(' '));
if (bad.length) {
  console.error('\nCHECK FAILED:', JSON.stringify(bad, null, 1));
  process.exit(1);
}
