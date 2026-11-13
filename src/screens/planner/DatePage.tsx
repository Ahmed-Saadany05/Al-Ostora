/** STEP 4 — Pick a launch date. PLACEHOLDER — owner: Aser. Conditions are judged at LANDING. */
import { useEffect, useState } from 'react';
import { useDayReport, useMetrics, usePlanLaunch, useSky } from '@/shared/data';
import { formatDeg, formatLatLon, formatUtc } from '@/shared/format';
import { missionUrl, useMission } from '@/shared/mission';
import type { IsoTime } from '@/shared/types';
import {
  Button,
  DateField,
  EmptyState,
  LoadingState,
  OwnerNote,
  Page,
  Panel,
  Pill,
  SkyTimeline,
  StepHeader,
} from '@/shared/ui';
import { useLunarDay } from './useLunarDay';
import s from './flow.module.css';

export function DatePage() {
  const { site, loading } = useMission();
  const { from, to, days } = useLunarDay();
  const nowIso = new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000).toISOString();
  const { data: metrics } = useMetrics(site, from, to);
  const { data: report } = useDayReport(site, from, days);
  const [launch, setLaunch] = useState<IsoTime>();
  const { data: plan } = usePlanLaunch(site, launch);
  const { data: landingSky } = useSky(site, plan?.landingDate ?? from);

  // Suggest: launch so that touchdown lands at the start of the best window.
  const { data: probe } = usePlanLaunch(site, from);
  useEffect(() => {
    if (launch || !probe) return;
    const transitMs = probe.transitDays * 86_400_000;
    const target = metrics?.bestWindow ? Date.parse(metrics.bestWindow.start) : Date.parse(from) + transitMs;
    // Never suggest a launch in the (real) past.
    const earliest = Math.ceil(Date.now() / 3_600_000) * 3_600_000;
    setLaunch(new Date(Math.max(earliest, Math.round((target - transitMs) / 3_600_000) * 3_600_000)).toISOString());
  }, [launch, probe, metrics, from]);

  if (loading) return <LoadingState title="Loading site…" />;
  if (!site)
    return (
      <Page width="narrow">
        <EmptyState
          title="No site chosen"
          action={
            <Button variant="primary" to={missionUrl.chooseSite()}>
              Choose a site
            </Button>
          }
        />
      </Page>
    );

  const landingInBest =
    plan && metrics?.bestWindow && plan.landingDate >= metrics.bestWindow.start && plan.landingDate <= metrics.bestWindow.end;

  return (
    <Page width="narrow">
      <StepHeader
        step="date"
        title="When do you"
        accent="launch?"
        back={{ to: missionUrl.stand(site.id), label: site.name }}
        meta={<span className="num">{formatLatLon(site.lat, site.lon)}</span>}
      />

      <Panel
        eyebrow={site.name}
        title="Launch and landing"
        source={plan?.source}
        next={
          <>
            <Button variant="ghost" to={missionUrl.compare([site.id], 'dates')}>
              Compare dates
            </Button>
            {launch && (
              <Button variant="primary" size="lg" to={missionUrl.launch(site.id, launch)}>
                Launch
              </Button>
            )}
          </>
        }
      >
        <div className={s.dateGrid}>
          {launch ? <DateField label="Launch date" value={launch} onChange={setLaunch} min={nowIso}hint="Pre-filled to land in the best window (or as soon as possible)." /> : <LoadingState compact />}
          <div className={s.landing}>
            <span className={s.label}>Touchdown</span>
            <span className={['num', s.landingDate].join(' ')}>{plan ? formatUtc(plan.landingDate) : '—'}</span>
            {plan && <span className={s.hint}>{plan.assumption}</span>}
          </div>
        </div>

        {landingSky && (
          <div className={s.statusRow}>
            <Pill tone={landingSky.sunVisible ? 'sun' : 'bad'} icon="sun" label={landingSky.sunVisible ? `Sun ${formatDeg(landingSky.sun.elDeg, 1)} at touchdown` : 'Dark at touchdown'} />
            <Pill tone={landingSky.earthVisible ? 'earth' : 'bad'} icon="antenna" label={landingSky.earthVisible ? 'Earth in view at touchdown' : 'No Earth link at touchdown'} />
            {plan && (landingInBest ? <Pill tone="good" icon="check" label="Inside best window" /> : <Pill tone="warn" icon="alert" label="Outside best window" />)}
          </div>
        )}

        {report && (
          <div className={s.stripBlock}>
            <SkyTimeline
              size="full"
              label="Touchdown on the lunar day"
              start={from}
              end={to}
              sunWindows={report.sunWindows}
              earthWindows={report.earthWindows}
              highlight={metrics?.bestWindow}
              now={plan?.landingDate}
            />
          </div>
        )}
      </Panel>
      <OwnerNote owner="Aser">Step 4 placeholder. Transit time comes from the engine (Goda) and is shown to the user.</OwnerNote>
    </Page>
  );
}
