/**
 * JPL Horizons proxy — shared by the Vercel function (api/horizons.ts) and the
 * Vite dev server (vite.config.ts). Browsers can't call Horizons directly (CORS),
 * so the app calls /api/horizons?target=sun&lat=-89.67&lon=129.78&start=…&stop=…&step=1h
 *
 * Only these parameters are accepted (not an open relay). Responses are cached.
 * Docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html
 */
import type { HorizonsQuery, HorizonsResponse, HorizonsRow } from '../../src/data/horizons/types';

const HORIZONS_API = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const TARGET_ID = { sun: '10', earth: '399' } as const;
const AU_KM = 149_597_870.7;
const MAX_ROWS = 20_000;
const MAX_DAYS = 800;
const TIMEOUT_MS = 25_000;
/**
 * JPL asks API clients for an application-specific User-Agent with contact info.
 * TODO(team): add the agreed team contact email — never a personal address.
 */
const USER_AGENT = 'RefaeyOnTheMoon/0.1 (+https://github.com/Ahmed-Saadany05/Al-Ostora; NASA Space Apps 2026)';

const memoryCache = new Map<string, HorizonsResponse>();

class BadRequest extends Error {}

const json = (status: number, body: unknown, cache = false) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cache
        ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
        : 'no-store',
    },
  });

function num(v: string | null, name: string, min: number, max: number, fallback?: number) {
  if (v === null || v === '') {
    if (fallback !== undefined) return fallback;
    throw new BadRequest(`Missing "${name}"`);
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new BadRequest(`"${name}" must be between ${min} and ${max}`);
  return n;
}

function time(v: string | null, name: string) {
  const t = v ? Date.parse(v) : NaN;
  if (!Number.isFinite(t)) throw new BadRequest(`"${name}" must be an ISO date, e.g. 2026-11-13T00:00:00Z`);
  return t;
}

/** '1h' → { horizons: '1 h', minutes: 60 } */
function step(v: string | null) {
  const m = /^(\d{1,4})\s*(m|h|d)$/.exec((v ?? '1h').trim());
  if (!m) throw new BadRequest('"step" must look like 30m, 1h or 1d');
  const n = Number(m[1]);
  if (n < 1) throw new BadRequest('"step" must be at least 1');
  const minutes = n * { m: 1, h: 60, d: 1440 }[m[2] as 'm' | 'h' | 'd'];
  return { text: `${n}${m[2]}`, horizons: `${n} ${m[2]}`, minutes };
}

export function parseQuery(url: URL): { query: Required<HorizonsQuery>; stepHorizons: string } {
  const p = url.searchParams;
  const target = p.get('target');
  if (target !== 'sun' && target !== 'earth') throw new BadRequest('"target" must be sun or earth');
  const lat = num(p.get('lat'), 'lat', -90, 90);
  const lon = num(p.get('lon'), 'lon', -180, 180);
  const altKm = num(p.get('altKm'), 'altKm', -10, 12, 0);
  const t0 = time(p.get('start'), 'start');
  const t1 = time(p.get('stop'), 'stop');
  if (t1 <= t0) throw new BadRequest('"stop" must be after "start"');
  if (t1 - t0 > MAX_DAYS * 86_400_000) throw new BadRequest(`Range must be ≤ ${MAX_DAYS} days`);
  const st = step(p.get('step'));
  if ((t1 - t0) / 60_000 / st.minutes > MAX_ROWS) throw new BadRequest(`Too many rows; use a bigger step (max ${MAX_ROWS})`);
  return {
    query: {
      target,
      lat,
      lon,
      altKm,
      start: new Date(t0).toISOString(),
      stop: new Date(t1).toISOString(),
      step: st.text,
    },
    stepHorizons: st.horizons,
  };
}

const hzTime = (iso: string) => iso.slice(0, 16).replace('T', ' '); // "2026-11-13 00:00"

export function buildHorizonsUrl(q: Required<HorizonsQuery>, stepHorizons: string) {
  const params: Record<string, string> = {
    format: 'json',
    COMMAND: `'${TARGET_ID[q.target]}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@301'", // observer on the Moon's surface
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${q.lon},${q.lat},${q.altKm}'`, // E-lon, lat, altitude km
    START_TIME: `'${hzTime(q.start)}'`,
    STOP_TIME: `'${hzTime(q.stop)}'`,
    STEP_SIZE: `'${stepHorizons}'`,
    // 4 az/el, 13 angular diameter, 20 range; Earth also 10 = illuminated fraction (its phase)
    QUANTITIES: q.target === 'earth' ? "'4,10,13,20'" : "'4,13,20'",
    ANG_FORMAT: "'DEG'",
    CSV_FORMAT: "'YES'",
  };
  return `${HORIZONS_API}?${new URLSearchParams(params).toString()}`;
}

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/**
 * Parse the CSV block between $$SOE and $$EOE. Column positions are read from the header row
 * (the line starting "Date__"), so extra columns or rise/set markers can't shift the values.
 */
export function parseEphemeris(result: string): HorizonsRow[] {
  const soe = result.indexOf('$$SOE');
  const eoe = result.indexOf('$$EOE');
  if (soe < 0 || eoe < 0) {
    const msg = result.split('\n').find((l) => /error|cannot|no ephemeris/i.test(l));
    throw new Error(`Horizons returned no ephemeris${msg ? `: ${msg.trim()}` : ''}`);
  }
  const headerLine = result
    .slice(0, soe)
    .split('\n')
    .reverse()
    .find((l) => l.trim().startsWith('Date__'));
  if (!headerLine) throw new Error('Horizons output has no column header');
  const head = headerLine.split(',').map((x) => x.trim());
  const col = (re: RegExp, required = true) => {
    const i = head.findIndex((h) => re.test(h));
    if (i < 0 && required) throw new Error(`Horizons column missing: ${re}`);
    return i;
  };
  const iAz = col(/^Azi/);
  const iEl = col(/^Elev/);
  const iDiam = col(/^Ang-diam/);
  const iDelta = col(/^delta$/);
  const iIllu = col(/^Illu%/, false);

  return result
    .slice(soe + 5, eoe)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const c = line.split(',').map((x) => x.trim());
      const m = /^(\d{4})-(\w{3})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(c[0]);
      if (!m) throw new Error(`Unexpected Horizons date: ${c[0]}`);
      const sec = m[6] ? m[6].padStart(2, '0') : '00';
      const time = new Date(`${m[1]}-${MONTHS[m[2]]}-${m[3]}T${m[4]}:${m[5]}:${sec}Z`).toISOString();
      const row: HorizonsRow = {
        time,
        azDeg: Number(c[iAz]),
        elDeg: Number(c[iEl]),
        angularDiameterDeg: Number(c[iDiam]) / 3600,
        distanceKm: Number(c[iDelta]) * AU_KM,
      };
      if (iIllu >= 0 && c[iIllu] !== '' && Number.isFinite(Number(c[iIllu]))) row.illuminationPct = Number(c[iIllu]);
      return row;
    });
}

/** Horizons sometimes answers 502/503 under load — retry a few times with a pause. */
async function fetchHorizonsWithRetry(url: string) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    });
    if ((res.status === 502 || res.status === 503 || res.status === 429) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    return res;
  }
}

export async function handleHorizons(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json(405, { error: 'GET only' });
  let parsed: ReturnType<typeof parseQuery>;
  try {
    parsed = parseQuery(new URL(request.url));
  } catch (e) {
    if (e instanceof BadRequest) return json(400, { error: e.message });
    throw e;
  }
  const horizonsUrl = buildHorizonsUrl(parsed.query, parsed.stepHorizons);
  const hit = memoryCache.get(horizonsUrl);
  if (hit) return json(200, hit, true);

  try {
    const res = await fetchHorizonsWithRetry(horizonsUrl);
    const body = (await res.json()) as { result?: string; error?: string; message?: string };
    if (!res.ok || !body.result) {
      return json(502, { error: `Horizons error: ${body.error ?? body.message ?? res.status}`, horizonsUrl });
    }
    const response: HorizonsResponse = {
      source: 'horizons',
      query: parsed.query,
      rows: parseEphemeris(body.result),
      horizonsUrl,
      fetchedAt: new Date().toISOString(),
    };
    if (memoryCache.size > 500) memoryCache.clear();
    memoryCache.set(horizonsUrl, response);
    return json(200, response, true);
  } catch (e) {
    return json(502, { error: `Could not reach JPL Horizons: ${(e as Error).message}`, horizonsUrl });
  }
}
