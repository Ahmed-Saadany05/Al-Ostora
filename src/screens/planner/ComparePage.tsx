/**
 * STEP 3 — Compare. Owner: Aser (cards) + Pink (mini panoramas, flow).
 * by=sites: 2–4 sites over the same lunar day → "Choose this site" → compare its dates.
 * by=dates: one site over 3 lunar days → pick a day (card button or a click on its timeline) →
 * the Moon view at that moment. Fits the screen: no page scroll; sideways only if cards don't fit.
 */
import { useNavigate } from 'react-router-dom';
import { SitePanorama } from '@/scenes';
import { useDayReport, useHorizon, useMetrics, useSky } from '@/shared/data';
import { formatDuration, formatUtc } from '@/shared/format';
import { MAX_COMPARE, missionUrl, useMission } from '@/shared/mission';
import { LUNAR, type IsoTime, type Site, type SiteMetrics } from '@/shared/types';
import {
  Button,
  EmptyState,
  Icon,
  LoadingState,
  Page,
  ProgressRing,
  SourceBadge,
  StepHeader,
  TimelineStrip,
} from '@/shared/ui';
import { useLunarDay } from './useLunarDay';
import s from './flow.module.css';

interface Candidate {
  key: string;
  site: Site;
  from: IsoTime;
  to: IsoTime;
  subtitle: string;
}

const REGION_NAME: Record<string, string> = { 'south-pole': 'South pole', 'north-pole': 'North pole', nearside: 'Near side', farside: 'Far side' };
const DAY_MS = LUNAR.synodicDays * 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

function CompareCard({
  c,
  index,
  metrics,
  best,
  byDates,
}: {
  c: Candidate;
  index: number;
  metrics?: SiteMetrics;
  best: boolean;
  byDates: boolean;
}) {
  const navigate = useNavigate();
  const { data: report } = useDayReport(c.site, c.from, LUNAR.synodicDays);
  const look = metrics?.bestWindow?.start ?? c.from;
  const { data: sky } = useSky(c.site, look);
  const { data: horizon } = useHorizon(c.site);
  return (
    <article className={[s.cmpCard, best && s.cmpBest].filter(Boolean).join(' ')}>
      <header className={s.cmpHead}>
        <span className={['num', s.cmpIndex].join(' ')}>{pad(index + 1)}</span>
        <div className={s.cmpTitle}>
          <strong>{c.site.name}</strong>
          <span>{c.subtitle}</span>
        </div>
        {best && <span className={s.bestTag}>Best</span>}
      </header>
      <div className={s.cmpView}>
        <SitePanorama site={c.site} time={look} sky={sky} horizon={horizon} compact />
      </div>
      <div className={s.cmpBody}>
        <div className={s.rings}>
          <ProgressRing value={metrics?.sunlitFraction} label="Sunlight" tone="sun" size={48} />
          <ProgressRing value={metrics?.earthVisibleFraction} label="Earth link" tone="earth" size={48} />
          <ProgressRing value={metrics?.bothFraction} label="Both" size={48} />
        </div>
        {report ? (
          <TimelineStrip
            start={c.from}
            end={c.to}
            sunWindows={report.sunWindows}
            earthWindows={report.earthWindows}
            highlight={metrics?.bestWindow}
            cells={40}
            ticks={0}
            size="sm"
            onSelectTime={byDates ? (t) => navigate(missionUrl.stand(c.site.id, t)) : undefined}
          />
        ) : (
          <LoadingState compact />
        )}
        <dl className={s.facts}>
          <dt>Best window</dt>
          <dd className="num">
            {metrics?.bestWindow ? `${formatUtc(metrics.bestWindow.start, false).slice(0, 6)} · ${formatDuration(metrics.bestWindow.durationH)}` : '—'}
          </dd>
          <dt>Longest darkness</dt>
          <dd className="num">{metrics ? formatDuration(metrics.longestNightH) : '—'}</dd>
          <dt>Match</dt>
          <dd className={s.match}>
            <span className={s.matchBar}>
              <span style={{ width: `${metrics?.matchScore ?? 0}%` }} />
            </span>
            <span className="num">{metrics?.matchScore ?? '—'}</span>
          </dd>
        </dl>
        <div className={s.cmpFoot}>
          {metrics && <SourceBadge source={metrics.source} />}
          {byDates ? (
            <Button variant={best ? 'primary' : 'secondary'} to={missionUrl.stand(c.site.id, metrics?.bestWindow?.start ?? c.from)}>
              Stand here
            </Button>
          ) : (
            <Button variant={best ? 'primary' : 'secondary'} to={missionUrl.dates(c.site.id)}>
              Choose this site
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ComparePage() {
  const navigate = useNavigate();
  const { sites, siteIds, compareBy, loading } = useMission();
  const { from } = useLunarDay();

  const candidates: Candidate[] =
    compareBy === 'dates' && sites[0]
      ? [0, 1, 2].map((k) => {
          const f = new Date(Date.parse(from) + k * DAY_MS).toISOString();
          return {
            key: `${sites[0].id}@${k}`,
            site: sites[0],
            from: f,
            to: new Date(Date.parse(f) + DAY_MS).toISOString(),
            subtitle: `Lunar day from ${formatUtc(f, false)}`,
          };
        })
      : sites.map((site) => ({
          key: site.id,
          site,
          from,
          to: new Date(Date.parse(from) + DAY_MS).toISOString(),
          subtitle: site.kind === 'custom' ? 'Custom coordinates' : REGION_NAME[site.region] ?? site.region,
        }));

  // Fixed number of hook calls (one per slot) — rules of hooks.
  const m0 = useMetrics(candidates[0]?.site, candidates[0]?.from ?? from, candidates[0]?.to ?? from).data;
  const m1 = useMetrics(candidates[1]?.site, candidates[1]?.from ?? from, candidates[1]?.to ?? from).data;
  const m2 = useMetrics(candidates[2]?.site, candidates[2]?.from ?? from, candidates[2]?.to ?? from).data;
  const m3 = useMetrics(candidates[3]?.site, candidates[3]?.from ?? from, candidates[3]?.to ?? from).data;
  const metrics = [m0, m1, m2, m3];
  const scores = candidates.map((_, i) => metrics[i]?.matchScore ?? -1);
  const bestIdx = scores.length && Math.max(...scores) >= 0 ? scores.indexOf(Math.max(...scores)) : -1;
  const best = bestIdx >= 0 ? { c: candidates[bestIdx], m: metrics[bestIdx]! } : undefined;

  if (loading) return <LoadingState title="Loading sites…" />;
  if (candidates.length === 0)
    return (
      <Page width="narrow">
        <EmptyState
          icon="compare"
          title="Nothing to compare yet"
          message="Pick two or more sites to see sunlight and Earth contact side by side."
          action={
            <Button variant="primary" to={missionUrl.chooseSite()}>
              Choose sites
            </Button>
          }
        />
      </Page>
    );

  const byDates = compareBy === 'dates';
  return (
    <div className={s.cmpPage}>
      <StepHeader
        step="compare"
        title="Compare"
        accent={byDates ? 'dates' : 'sites'}
        back={{ to: missionUrl.chooseSite(siteIds), label: byDates ? 'Change site' : 'Change sites' }}
        meta={byDates && sites[0] ? sites[0].name : undefined}
        aside={
          best?.m.bestWindow && (
            <div className={s.bestMatch}>
              <span className={s.label}>{byDates ? 'Best day' : 'Best match'}</span>
              <span>
                {!byDates && <>{best.c.site.name} · </>}
                <span className="num">{formatUtc(best.m.bestWindow.start, false).slice(0, 6)}</span> —{' '}
                <span className="num">{formatDuration(best.m.bestWindow.durationH)}</span> window
              </span>
            </div>
          )
        }
      />
      {byDates && <p className={s.cmpHint}>Pick a lunar day: “Stand here” opens its best moment, or click any point on a timeline.</p>}

      <div className={s.cmpGrid}>
        {candidates.map((c, i) => (
          <CompareCard key={c.key} c={c} index={i} metrics={metrics[i]} best={i === bestIdx} byDates={byDates} />
        ))}
        {!byDates && candidates.length < MAX_COMPARE && (
          <button type="button" className={s.addSlot} onClick={() => navigate(missionUrl.chooseSite(siteIds))}>
            <span className={s.addIcon}>
              <Icon name="plus" size={22} />
            </span>
            <strong>Add a site</strong>
            <span className="num">
              {candidates.length} of {MAX_COMPARE} slots used
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
