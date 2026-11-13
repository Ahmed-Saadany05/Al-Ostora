/**
 * STEP 5 — Launch → landing. Owner: Aser (summary) + Pink (sequence, landing view).
 * The Earth–Moon timelapse (LaunchSequence), then the Moon view at touchdown with no time bar:
 * where you landed, the Sun and Earth at that moment, and the next actions. (Fun facts come later.)
 */
import { useCallback, useState } from 'react';
import { LaunchSequence, SitePanorama } from '@/scenes';
import { usePlanLaunch, useSky } from '@/shared/data';
import { formatDeg, formatUtc } from '@/shared/format';
import { missionUrl, useMission } from '@/shared/mission';
import { useTime } from '@/shared/store/time';
import { Button, EmptyState, Eyebrow, LoadingState, Page, Pill } from '@/shared/ui';
import { VerifyDrawer } from './VerifyDrawer';
import st from './stand/stand.module.css';

export function LaunchPage() {
  const { site, launchDate, loading } = useMission();
  const { data: plan } = usePlanLaunch(site, launchDate);
  const { data: sky } = useSky(plan ? site : undefined, plan?.landingDate ?? '');
  const [landed, setLanded] = useState(false);
  const [verify, setVerify] = useState(false);
  const setTime = useTime((x) => x.setTime);
  // Landed: the shared clock moves to touchdown so the view's Sun/Earth paths are that lunar day's.
  const onDone = useCallback(() => {
    if (plan) setTime(plan.landingDate);
    setLanded(true);
  }, [plan, setTime]);

  if (loading || (site && launchDate && !plan)) return <LoadingState title="Fuelling the rocket…" />;
  if (!site || !launchDate || !plan)
    return (
      <Page width="narrow">
        <EmptyState
          title="No mission planned"
          message="Choose a site and a launch date first."
          action={
            <Button variant="primary" to={missionUrl.chooseSite()}>
              Plan a mission
            </Button>
          }
        />
      </Page>
    );

  if (!landed) return <LaunchSequence site={site} plan={plan} onDone={onDone} />;

  return (
    <section className={st.stage}>
      <SitePanorama site={site} time={plan.landingDate} sky={sky} mode="stand" />

      <div className={st.titleBlock}>
        <Eyebrow>
          Touchdown · <span className="num">{formatUtc(plan.landingDate)}</span>
        </Eyebrow>
        <h1 className={st.title}>{site.name}</h1>
        {sky && (
          <div className={st.statusRow}>
            <Pill tone={sky.sunVisible ? 'sun' : 'neutral'} icon="sun" label={sky.sunVisible ? `Sun ${formatDeg(sky.sun.elDeg, 1)} · panels in sunlight` : 'In shadow at touchdown'} />
            <Pill tone={sky.earthVisible ? 'earth' : 'neutral'} icon="antenna" label={sky.earthVisible ? `Earth ${formatDeg(sky.earth.elDeg, 1)} · direct radio link` : 'No direct Earth link'} />
          </div>
        )}
        <p className={st.muted}>
          Launched <span className="num">{formatUtc(plan.launchDate)}</span> · {plan.assumption}
        </p>
      </div>

      <div className={st.launch}>
        <div className={st.statusRow}>
          <Button variant="ghost" icon={null} leadingIcon="check" onClick={() => setVerify(true)}>
            Verify with JPL Horizons
          </Button>
          <Button variant="secondary" icon={null} leadingIcon="arrowLeft" to={missionUrl.date(site.id)}>
            Change date
          </Button>
          <Button variant="primary" size="lg" to={missionUrl.chooseSite()}>
            Plan another mission
          </Button>
        </div>
      </div>
      <VerifyDrawer site={site} time={plan.landingDate} open={verify} onClose={() => setVerify(false)} />
    </section>
  );
}
