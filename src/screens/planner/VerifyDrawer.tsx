/**
 * Owner: Aser. "Verify with JPL Horizons": our numbers next to NASA JPL's for the same site and
 * the same MINUTE. JPL knows nothing about terrain, so we only compare FLAT-HORIZON elevation
 * (`elDeg`) and azimuth. This proves our astronomy, not our terrain.
 *
 * How it works:
 *  1. When the drawer opens, the moment is FROZEN (rounded down to the minute). The timeline can
 *     keep playing behind it without re-asking JPL every tick.
 *  2. Ours: useSky(site, that minute). JPL: /api/horizons from that minute to +1 min, step 1m,
 *     then we pick the row whose time equals that minute. (Offline, a recorded answer is matched
 *     by date only, so it might be for another minute: then we say so instead of comparing.)
 *  3. Δ = ours − JPL. Azimuth wraps around north: 359.8° vs 0.1° is 0.3°, not 359.7°.
 *  4. Verdict only when ours is real (live provider). Demo numbers are fake by design, so in demo
 *     mode we show a note instead of a red "differs" that would look like a bug.
 */
import { useEffect, useState } from 'react';
import { fetchHorizons, type HorizonsResponse, type HorizonsRow } from '@/data/horizons/client';
import { useSky } from '@/shared/data';
import { formatDeg, formatUtc } from '@/shared/format';
import type { IsoTime, Site } from '@/shared/types';
import { Button, Drawer, ErrorState, Icon, LoadingState, Pill } from '@/shared/ui';
import { usePlannerParams } from './SettingsDrawer';
import s from './flow.module.css';

/** Max difference that still counts as "matches". Confirm with Goda's interpolation accuracy. */
const TOLERANCE_DEG = 0.05;

const MINUTE = 60_000;
const floorToMinute = (iso: IsoTime) => new Date(Math.floor(Date.parse(iso) / MINUTE) * MINUTE).toISOString();

/** Shortest signed angle from b to a, in −180…+180. */
const azDiff = (a: number, b: number) => ((((a - b + 540) % 360) + 360) % 360) - 180;

/** The JPL row for exactly this minute (±30 s), or undefined. */
const rowAt = (res: HorizonsResponse, at: IsoTime) => res.rows.find((r) => Math.abs(Date.parse(r.time) - Date.parse(at)) < MINUTE / 2);

export function VerifyDrawer({ site, time, open, onClose }: { site: Site; time: IsoTime; open: boolean; onClose: () => void }) {
  const params = usePlannerParams();
  // V0: freeze the moment when the drawer opens.
  const [at, setAt] = useState<IsoTime>(() => floorToMinute(time));
  useEffect(() => {
    if (open) setAt(floorToMinute(time));
    // Only on open (deps = [open]): later clock ticks must not change the checked moment.
  }, [open]);

  const { data: sky } = useSky(open ? site : undefined, at, params);
  const [res, setRes] = useState<{ sun: HorizonsResponse; earth: HorizonsResponse }>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0); // V5: bump to retry

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setRes(undefined);
    setError(undefined);
    // V1: exactly this minute, 1-minute step. NOTE for Hagras: recorded answers must use step=1m.
    const q = { lat: site.lat, lon: site.lon, start: at, stop: new Date(Date.parse(at) + MINUTE).toISOString(), step: '1m' };
    Promise.all([fetchHorizons({ ...q, target: 'sun' }, ctrl.signal), fetchHorizons({ ...q, target: 'earth' }, ctrl.signal)]).then(
      ([sun, earth]) => setRes({ sun, earth }),
      (e: Error) => !ctrl.signal.aborted && setError(e.message),
    );
    return () => ctrl.abort();
  }, [open, site.lat, site.lon, at, attempt]);

  const jplSun: HorizonsRow | undefined = res && rowAt(res.sun, at);
  const jplEarth: HorizonsRow | undefined = res && rowAt(res.earth, at);
  const missingMinute = res && (!jplSun || !jplEarth);

  const isLive = sky !== undefined && sky.source !== 'demo';
  const rows = [
    { label: 'Sun elevation', ours: sky?.sun.elDeg, jpl: jplSun?.elDeg, az: false },
    { label: 'Sun azimuth', ours: sky?.sun.azDeg, jpl: jplSun?.azDeg, az: true },
    { label: 'Earth elevation', ours: sky?.earth.elDeg, jpl: jplEarth?.elDeg, az: false },
    { label: 'Earth azimuth', ours: sky?.earth.azDeg, jpl: jplEarth?.azDeg, az: true }, // V4
  ].map((r) => {
    const delta = r.ours === undefined || r.jpl === undefined ? undefined : r.az ? azDiff(r.ours, r.jpl) : r.ours - r.jpl; // V2
    return { ...r, delta, ok: delta === undefined ? undefined : Math.abs(delta) <= TOLERANCE_DEG };
  });
  const worst = Math.max(0, ...rows.map((r) => (r.delta === undefined ? 0 : Math.abs(r.delta))));
  const allOk = rows.every((r) => r.ok);
  const retry = (
    <Button variant="secondary" leadingIcon="clock" icon={null} onClick={() => setAttempt((n) => n + 1)}>
      Try again
    </Button>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow={`${site.name} · ${formatUtc(at)}`}
      title="Check against NASA"
      source="horizons"
      // No footer action: the raw JPL links were removed on purpose (the drawer closes with ✕ / Esc).
      next={null}
    >
      <p className={s.muted}>
        Our position of the Sun and Earth next to NASA JPL Horizons, for the same spot and the same minute. Elevations are above the
        flat horizon, because JPL doesn't know the terrain.
      </p>

      {!res && !error && <LoadingState compact title="Asking JPL Horizons…" />}
      {error && <ErrorState compact title="Horizons didn't answer" message={error} action={retry} />}
      {missingMinute && (
        <ErrorState
          compact
          title="No answer for this exact minute"
          message="The recorded JPL answer doesn't cover this moment, so there is nothing fair to compare. Try again online, or pick a recorded time."
          action={retry}
        />
      )}

      {res && !missingMinute && (
        <>
          <div className={s.verifyStatus}>
            {(res.sun.fixture || res.earth.fixture) && <Pill tone="warn" icon="alert" label="Offline — recorded answer" />}
            {/* V3: verdict only when our numbers are real. */}
            {sky &&
              isLive &&
              (allOk ? (
                <Pill tone="good" icon="check" label={`Matches JPL within ${formatDeg(TOLERANCE_DEG, 2, false)}`} />
              ) : (
                <Pill tone="warn" icon="alert" label={`Differs by up to ${formatDeg(worst, 2, false)}`} />
              ))}
            {sky && !isLive && <Pill tone="demo" icon="beaker" label="Ours is demo data" />}
          </div>

          <table className={s.table}>
            <thead>
              <tr>
                <th />
                <th>Ours</th>
                <th>JPL</th>
                <th>Δ</th>
                {isLive && <th aria-label="Result" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="num">{r.ours === undefined ? '—' : formatDeg(r.ours, 2, !r.az)}</td>
                  <td className="num">{r.jpl === undefined ? '—' : formatDeg(r.jpl, 2, !r.az)}</td>
                  <td className="num">{r.delta === undefined ? '—' : formatDeg(r.delta, 2)}</td>
                  {isLive && (
                    <td className={r.ok ? s.verifyOk : s.verifyOff}>
                      <Icon name={r.ok ? 'check' : 'alert'} size={14} />
                      <span className="visually-hidden">{r.ok ? 'matches' : 'differs'}</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {sky && !isLive && (
            <p className={s.muted}>
              Our numbers come from the demo provider right now: realistic but made up, so they are <strong>not expected</strong> to match
              JPL. With live NASA data, this panel shows ✓ when each row is within {formatDeg(TOLERANCE_DEG, 2, false)}.
            </p>
          )}
        </>
      )}
    </Drawer>
  );
}
