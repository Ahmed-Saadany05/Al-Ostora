/** STEP 2 — Stand on site. PLACEHOLDER — owner: Aser (HUD) + Pink (panorama). */
import { useState } from 'react';
import { SitePanorama } from '@/scenes';
import { Explain } from '@/screens/home/Explain';
import { nextTransition, useDayReport, useHorizon, useMetrics, useSky } from '@/shared/data';
import { compass, formatDeg, formatLatLon, formatUtc } from '@/shared/format';
import { missionUrl, useMission } from '@/shared/mission';
import { useTime } from '@/shared/store/time';
import type { BodyPosition, IsoTime, SkyState } from '@/shared/types';
import {
  Button,
  CountdownChip,
  EmptyState,
  Eyebrow,
  Icon,
  IconButton,
  LoadingState,
  OwnerNote,
  Page,
  Pill,
  SourceBadge,
  StepHeader,
  Tabs,
  TimelineLegend,
  TimelineStrip,
} from '@/shared/ui';
import { useLunarDay } from './useLunarDay';
import { VerifyDrawer } from './VerifyDrawer';
import s from './flow.module.css';

function BodyCard({
  kind,
  body,
  visible,
  next,
  now,
}: {
  kind: 'sun' | 'earth';
  body: BodyPosition;
  visible: boolean;
  next: IsoTime | null;
  now: IsoTime;
}) {
  const sun = kind === 'sun';
  return (
    <section className={s.bodyCard}>
      <div className={s.bodyHead}>
        <Pill tone={visible ? kind : 'neutral'} icon={sun ? 'sun' : 'antenna'} label={sun ? 'Sun · solar power' : 'Earth · radio link'} />
      </div>
      <p className={s.bigNum}>
        <span className="num">{formatDeg(body.elDeg, 1)}</span>
      </p>
      <p className={s.muted}>
        {body.clearanceDeg >= 0 ? 'above the skyline' : `hidden ${formatDeg(-body.clearanceDeg, 1, false)} behind terrain`}
      </p>
      <div className={s.bodyFoot}>
        <CountdownChip kind={sun ? (visible ? 'sunset' : 'sunrise') : visible ? 'earthset' : 'earthrise'} target={next} now={now} />
        <span className={s.look}>
          Look toward{' '}
          <span className="num">
            {compass(body.azDeg)} · {Math.round(body.azDeg)}°
          </span>
        </span>
      </div>
    </section>
  );
}

export function StandPage() {
  const { site, loading } = useMission();
  const { from, to, days } = useLunarDay();
  const time = useTime((st) => st.time);
  const playing = useTime((st) => st.playing);
  const toggle = useTime((st) => st.toggle);
  const setTime = useTime((st) => st.setTime);
  const [mode, setMode] = useState<'stand' | 'above'>('stand');
  const [verify, setVerify] = useState(false);

  const { data: sky } = useSky(site, time);
  const { data: horizon } = useHorizon(site);
  const { data: report } = useDayReport(site, from, days);
  const { data: metrics } = useMetrics(site, from, to);

  if (loading) return <LoadingState title="Loading site…" />;
  if (!site)
    return (
      <Page width="narrow">
        <EmptyState
          title="No site chosen"
          message="Pick a landing site first."
          action={
            <Button variant="primary" to={missionUrl.chooseSite()}>
              Choose a site
            </Button>
          }
        />
      </Page>
    );

  const ahead = report?.samples.filter((x) => x.time >= time) ?? [];
  const sunUp = (x: SkyState) => x.sunVisible;
  const earthUp = (x: SkyState) => x.earthVisible;
  const status = sky
    ? sky.sunVisible && sky.earthVisible
      ? 'Sunlit and in contact with Earth'
      : sky.sunVisible
        ? 'Sunlit · no Earth link'
        : sky.earthVisible
          ? 'In shadow · Earth in view'
          : 'In shadow · no Earth link'
    : 'Reading the sky…';

  return (
    <Page>
      <StepHeader
        step="stand"
        title={site.name}
        back={{ to: missionUrl.chooseSite([site.id]), label: 'Back to sites' }}
        meta={<span className="num">{formatLatLon(site.lat, site.lon)}</span>}
        aside={
          <Tabs
            label="View"
            variant="pill"
            value={mode}
            onChange={setMode}
            items={[
              { id: 'stand', label: 'Stand here' },
              { id: 'above', label: 'Fly above' },
            ]}
          />
        }
      />

      <div className={s.statusRow}>
        <Pill tone={sky?.sunVisible ? 'sun' : 'neutral'} icon={sky?.sunVisible ? 'sun' : 'moon'} label={status} />
        {sky && <SourceBadge source={sky.source} />}
        <span className={s.grow} />
        {site.region === 'farside' ? <Explain id="farside" /> : site.region === 'south-pole' ? <Explain id="low-sun" /> : <Explain id="libration" />}
      </div>

      <div className={s.standGrid}>
        <div className={s.viewport}>
          <SitePanorama site={site} time={time} sky={sky} horizon={horizon} mode={mode} />
        </div>
        <div className={s.bodyCol}>
          {sky ? (
            <>
              <BodyCard kind="sun" body={sky.sun} visible={sky.sunVisible} now={time} next={nextTransition(ahead, sunUp, sky.sunVisible)} />
              <BodyCard kind="earth" body={sky.earth} visible={sky.earthVisible} now={time} next={nextTransition(ahead, earthUp, sky.earthVisible)} />
            </>
          ) : (
            <LoadingState compact />
          )}
        </div>
      </div>

      <section className={s.timeline}>
        <div className={s.timelineHead}>
          <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} onClick={toggle} active={playing} />
          <div>
            <Eyebrow>Sky at</Eyebrow>
            <span className="num">{formatUtc(time)}</span>
          </div>
          <span className={s.grow} />
          <TimelineLegend />
          {metrics?.bestWindow && (
            <Button variant="secondary" onClick={() => setTime(metrics.bestWindow!.start)}>
              Jump to best
            </Button>
          )}
        </div>
        {report ? (
          <TimelineStrip
            start={from}
            end={to}
            sunWindows={report.sunWindows}
            earthWindows={report.earthWindows}
            highlight={metrics?.bestWindow}
            now={time}
            onSelectTime={setTime}
          />
        ) : (
          <LoadingState compact />
        )}
        <div className={s.timelineFoot}>
          <Button variant="ghost" icon={null} leadingIcon="check" onClick={() => setVerify(true)}>
            Verify with JPL Horizons
          </Button>
          <span className={s.grow} />
          <Button variant="secondary" leadingIcon="plus" icon={null} to={missionUrl.chooseSite([site.id])}>
            Compare
          </Button>
          <Button variant="primary" to={missionUrl.date(site.id)}>
            Choose a launch date
          </Button>
        </div>
      </section>

      <VerifyDrawer site={site} time={time} open={verify} onClose={() => setVerify(false)} />
      <OwnerNote owner="Aser (cards, timeline) · Pink (panorama)">
        Step 2 placeholder. <Icon name="info" size={12} /> Panorama is a 2D stand-in for the 3D terrain view.
      </OwnerNote>
    </Page>
  );
}
