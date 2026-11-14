// Records the Sun and Earth at each past mission's touchdown minute, straight from JPL Horizons (via the repo's own
// proxy handler, read-only). Run: node scripts/journey/record-landings.mjs  → src/screens/journey/landingSky.json
// If Horizons can't be reached it stops: nothing is estimated. Touchdown times and their sources live in LANDINGS below.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { handleHorizons } from '../../api/_lib/horizons-handler.ts';

const root = (p) => fileURLToPath(new URL('../../' + p, import.meta.url));
const catalogue = readFileSync(root('src/data/sites/catalogue.ts'), 'utf8');
function site(id) {
  const m = new RegExp(String.raw`id: '${id}',[\s\S]*?lat: (-?[\d.]+),\s*lon: (-?[\d.]+)`).exec(catalogue);
  if (!m) throw new Error(`site ${id} is not in the catalogue`);
  return { lat: Number(m[1]), lon: Number(m[2]) };
}

/** mission id → catalogue site + touchdown (UTC) + where that time comes from. */
const LANDINGS = [
  ['apollo-11', 'apollo-11', '1969-07-20T20:17:40Z', 'NASA / engine fixture apollo_landings.json'],
  ['apollo-15', 'apollo-15', '1971-07-30T22:16:29Z', 'NSSDCA Apollo 15 page (nssdc.gsfc.nasa.gov/planetary/lunar/apollo15info.html)'],
  ['lunokhod-1', 'luna-17', '1970-11-17T03:47:00Z', 'NSSDCA Luna 17 / Lunokhod 1 catalogue entry (1970-095A)'],
  ['change-4', 'change-4', '2019-01-03T02:26:00Z', 'CNSA; same time as the recorded Refaey facts (facts.json)'],
  ['chandrayaan-3', 'chandrayaan-3', '2023-08-23T12:33:00Z', 'ISRO: 18:03 IST on 23 Aug 2023'],
  ['athena', 'im-2-athena', '2025-03-06T17:30:00Z', 'Intuitive Machines IM-2; same time as the recorded Refaey facts (facts.json)'],
];

const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
async function row(target, s, t) {
  const floor = iso(Math.floor(Date.parse(t) / 60_000) * 60_000);
  const qs = new URLSearchParams({ target, lat: String(s.lat), lon: String(s.lon), altKm: '0', start: floor, stop: iso(Date.parse(floor) + 120_000), step: '1m' });
  const res = await handleHorizons(new Request(`http://local/api/horizons?${qs}`));
  const body = await res.json();
  if (!res.ok || body.source !== 'horizons') throw new Error(`Horizons failed for ${target}: ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  return { ...body.rows[0], horizonsUrl: body.horizonsUrl };
}

const out = { retrieved: new Date().toISOString().slice(0, 10), source: 'JPL Horizons via api/_lib/horizons-handler.ts, 1-minute rows at touchdown', landings: {} };
for (const [id, siteId, time, timeSource] of LANDINGS) {
  const s = site(siteId);
  const sun = await row('sun', s, time);
  const earth = await row('earth', s, time);
  const pick = (r) => ({ azDeg: +r.azDeg.toFixed(2), elDeg: +r.elDeg.toFixed(2), distanceKm: Math.round(r.distanceKm), angularDiameterDeg: +r.angularDiameterDeg.toFixed(4), horizonsUrl: r.horizonsUrl });
  out.landings[id] = { siteId, time, timeSource, lat: s.lat, lon: s.lon, sun: pick(sun), earth: { ...pick(earth), illuminationPct: earth.illuminationPct ?? null } };
  console.log(id, 'sun', sun.elDeg.toFixed(2), 'earth', earth.elDeg.toFixed(2));
}
writeFileSync(root('src/screens/journey/landingSky.json'), JSON.stringify(out, null, 2) + '\n');
