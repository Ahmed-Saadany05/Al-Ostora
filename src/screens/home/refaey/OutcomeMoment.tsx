import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProvider, useHorizon, usePlanLaunch, useSites } from '@/shared/data';
import { formatUtc } from '@/shared/format';
import { missionUrl, useMission } from '@/shared/mission';
import { daysAndHours } from './facts/display';
import { MomentCard, type MomentContext } from './MomentCard';
import { RefaeyCard, type CardPlacement } from './RefaeyCard';
import type { Reply } from './dialogues/dialogues';

/** Longest we wait for the engine's answer; after that the card just closes with its neutral line (no message). */
const WAIT_MS = 15_000;

type Engine = typeof import('@/engine');
type Alt = Awaited<ReturnType<Engine['suggestAlternatives']>>;
type Outcome = { hours: { sunHours: number; earthHours: number }; alt: Alt } | 'none' | 'demo';

/**
 * The touchdown card: what the first lunar day looks like at the landing, and, only if the engine finds one, a better
 * site or date. Numbers appear only on the live provider with the LOLA skyline; otherwise just the neutral closing line.
 * suggestAlternatives returns null both for "nothing better" and for "no data", so a null never becomes a claim.
 */
export function OutcomeMoment({ placement: asked }: { placement: CardPlacement }) {
  const placement: CardPlacement = asked === 'stage' ? 'stage-high' : asked;
  const navigate = useNavigate();
  const { site, launchDate } = useMission();
  const { data: plan } = usePlanLaunch(site, launchDate);
  const { data: horizon } = useHorizon(site);
  const { data: sites } = useSites();
  const live = getProvider().id === 'live' && horizon?.source === 'lola';
  const landing = plan?.landingDate;
  const [outcome, setOutcome] = useState<Outcome | 'waiting'>(live ? 'waiting' : 'demo');

  useEffect(() => {
    if (!live || !site || !landing) {
      setOutcome('demo');
      return;
    }
    let cancelled = false;
    setOutcome('waiting');
    const timeout = new Promise<'none'>((resolve) => window.setTimeout(() => resolve('none'), WAIT_MS));
    const work = import('@/engine').then(async (e): Promise<Outcome> => {
      const [hours, alt] = await Promise.all([e.firstLunarDayHours(site, landing), e.suggestAlternatives(site, landing)]);
      return { hours, alt };
    });
    void Promise.race([work, timeout])
      .catch((): 'none' => 'none')
      .then((r) => !cancelled && setOutcome(r));
    return () => {
      cancelled = true;
    };
  }, [live, site, landing]);

  const context: MomentContext | null = useMemo(() => {
    if (outcome === 'waiting') return null;
    if (outcome === 'none' || outcome === 'demo' || !site || !landing) return { horizons: false, values: {}, flags: {} };
    const { hours, alt } = outcome;
    const altName = alt?.kind === 'site' ? sites?.find((s) => s.id === alt.siteId)?.name : undefined;
    return {
      horizons: true,
      flags: { altBetter: alt?.kind === 'site' && !!altName, altBetterDate: alt?.kind === 'date' },
      values: {
        siteName: site.name,
        landingDate: formatUtc(landing, false),
        sunHours: daysAndHours(hours.sunHours),
        earthHours: daysAndHours(hours.earthHours),
        ...(alt ? { altGain: daysAndHours(alt.sunHoursGain) } : {}),
        ...(altName ? { altSite: altName } : {}),
        ...(alt?.kind === 'date' ? { altDate: formatUtc(alt.landingIso, false) } : {}),
      },
    };
  }, [outcome, site, landing, sites]);

  if (!site) return null;
  if (context === null) return <RefaeyCard id="refaey-moment-outcome" placement={placement} mood="neutral" lines={['Give me a second…']} />;

  const alt = outcome !== 'none' && outcome !== 'demo' && outcome !== 'waiting' ? outcome.alt : null;
  const onAction = (a: Reply['action']) => {
    if (a?.type !== 'compareAlternative' || !alt) return false;
    navigate(alt.kind === 'site' && alt.siteId ? missionUrl.compare([site.id, alt.siteId], 'sites') : missionUrl.compare([site.id], 'dates'));
    return true;
  };
  // Live answer → the landing story. Demo (no live numbers, no LOLA skyline) → the quiet line. Timeout or error → the neutral close.
  const id = context.horizons ? 'outcome-play' : outcome === 'demo' ? 'outcome-demo' : 'outcome-close';
  return <MomentCard id={id} placement={placement} context={context} onAction={onAction} once={false} />;
}
