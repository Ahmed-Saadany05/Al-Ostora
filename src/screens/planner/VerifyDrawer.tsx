/**
 * Owner: Aser. "Verify with JPL Horizons" — our number next to NASA's for the same site + time.
 * Elevations from Horizons are above the flat horizon, so we compare against our `elDeg`.
 */
import { useEffect, useState } from 'react';
import { fetchHorizons, type HorizonsResponse } from '@/data/horizons/client';
import { useSky } from '@/shared/data';
import { formatDeg, formatUtc } from '@/shared/format';
import type { IsoTime, Site } from '@/shared/types';
import { Button, Drawer, ErrorState, LoadingState, Pill } from '@/shared/ui';
import s from './flow.module.css';

export function VerifyDrawer({ site, time, open, onClose }: { site: Site; time: IsoTime; open: boolean; onClose: () => void }) {
  const { data: sky } = useSky(open ? site : undefined, time);
  const [res, setRes] = useState<{ sun: HorizonsResponse; earth: HorizonsResponse }>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setRes(undefined);
    setError(undefined);
    const start = `${time.slice(0, 13)}:00:00.000Z`;
    const stop = new Date(Date.parse(start) + 3_600_000).toISOString();
    const q = { lat: site.lat, lon: site.lon, start, stop, step: '1h' };
    Promise.all([fetchHorizons({ ...q, target: 'sun' }, ctrl.signal), fetchHorizons({ ...q, target: 'earth' }, ctrl.signal)]).then(
      ([sun, earth]) => setRes({ sun, earth }),
      (e: Error) => !ctrl.signal.aborted && setError(e.message),
    );
    return () => ctrl.abort();
  }, [open, site.lat, site.lon, time]);

  const row = (label: string, ours: number | undefined, theirs: number | undefined) => (
    <tr>
      <td>{label}</td>
      <td className="num">{ours === undefined ? '—' : formatDeg(ours)}</td>
      <td className="num">{theirs === undefined ? '—' : formatDeg(theirs)}</td>
      <td className="num">{ours === undefined || theirs === undefined ? '—' : formatDeg(ours - theirs)}</td>
    </tr>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow={`${site.name} · ${formatUtc(`${time.slice(0, 13)}:00:00Z`)}`}
      title="Check against NASA"
      source="horizons"
      next={
        res && (
          <Button variant="primary" href={res.sun.horizonsUrl} icon="external">
            Open the raw JPL request
          </Button>
        )
      }
    >
      <p className={s.muted}>Our elevation vs JPL Horizons for the same spot and hour (above the flat horizon).</p>
      {!res && !error && <LoadingState compact title="Asking JPL Horizons…" />}
      {error && <ErrorState compact title="Horizons didn't answer" message={error} />}
      {res && (
        <>
          {(res.sun.fixture || res.earth.fixture) && <Pill tone="warn" icon="alert" label="Offline — recorded answer" />}
          <table className={s.table}>
            <thead>
              <tr>
                <th />
                <th>Ours</th>
                <th>JPL</th>
                <th>Δ</th>
              </tr>
            </thead>
            <tbody>
              {row('Sun elevation', sky?.sun.elDeg, res.sun.rows[0]?.elDeg)}
              {row('Earth elevation', sky?.earth.elDeg, res.earth.rows[0]?.elDeg)}
              {row('Sun azimuth', sky?.sun.azDeg, res.sun.rows[0]?.azDeg)}
            </tbody>
          </table>
          {sky?.source === 'demo' && <p className={s.muted}>Ours is demo data right now — the live engine will close this gap.</p>}
        </>
      )}
    </Drawer>
  );
}
