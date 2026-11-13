/** STEP 5 — Launch → landing, then the mission summary. PLACEHOLDER — owner: Aser (summary) + Pink (sequence). */
import { useCallback, useState } from 'react';
import { LaunchSequence } from '@/scenes';
import { usePlanLaunch, useSky } from '@/shared/data';
import { formatDeg, formatUtc } from '@/shared/format';
import { missionUrl, useMission } from '@/shared/mission';
import { Button, EmptyState, LoadingState, Metric, OwnerNote, Page, Panel, StepHeader } from '@/shared/ui';
import { VerifyDrawer } from './VerifyDrawer';
import s from './flow.module.css';

export function LaunchPage() {
  const { site, launchDate, loading } = useMission();
  const { data: plan } = usePlanLaunch(site, launchDate);
  const { data: sky } = useSky(plan ? site : undefined, plan?.landingDate ?? '');
  const [landed, setLanded] = useState(false);
  const [verify, setVerify] = useState(false);
  const onDone = useCallback(() => setLanded(true), []);

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
    <Page width="narrow">
      <StepHeader step="launch" title="Touchdown at" accent={`${site.name}.`} back={{ to: missionUrl.date(site.id), label: 'Change date' }} />
      <Panel
        eyebrow="Mission summary"
        title="What your lander sees on arrival"
        source={sky?.source}
        next={
          <>
            <Button variant="ghost" icon={null} leadingIcon="check" onClick={() => setVerify(true)}>
              Verify with JPL Horizons
            </Button>
            <Button variant="primary" to={missionUrl.chooseSite()}>
              Plan another mission
            </Button>
          </>
        }
      >
        <div className={s.summary}>
          <Metric label="Launch" icon="clock" value={null} display={formatUtc(plan.launchDate)} unit="" />
          <Metric label="Touchdown" icon="pin" value={null} display={formatUtc(plan.landingDate)} unit="" hint={plan.assumption} />
          <Metric label="Sun at touchdown" icon="sun" tone="sun" value={null} display={sky ? formatDeg(sky.sun.elDeg, 1) : '—'} unit="°" hint={sky?.sunVisible ? 'Panels in sunlight' : 'In shadow'} />
          <Metric label="Earth at touchdown" icon="antenna" tone="earth" value={null} display={sky ? formatDeg(sky.earth.elDeg, 1) : '—'} unit="°" hint={sky?.earthVisible ? 'Direct radio link' : 'No direct link'} />
        </div>
      </Panel>
      <VerifyDrawer site={site} time={plan.landingDate} open={verify} onClose={() => setVerify(false)} />
      <OwnerNote owner="Aser (summary) · Pink (3D launch)">Step 5 placeholder. The launch animation is a text stand-in.</OwnerNote>
    </Page>
  );
}
