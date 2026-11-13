/**
 * STEP 3 — Compare. PLACEHOLDER — owner: Aser (cards) + Pink (mini panoramas).
 * by=sites: 2–4 sites over the same lunar day. by=dates: one site over 3 lunar days.
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
  OwnerNote,
  Page,
  ProgressRing,
  SourceBadge,
  StepHeader,
  Tabs,
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

const DAY_MS = LUNAR.synodicDays * 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

function CompareCard({ c, index, metrics, best }: { c: Candidate; index: number; metrics?: SiteMetrics; best: boolean }) {
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
          <ProgressRing value={metrics?.sunlitFraction} label="Sunlight" tone="sun" />
          <ProgressRing value={metrics?.earthVisibleFraction} label="Earth link" tone="earth" />
          <ProgressRing value={metrics?.bothFraction} label="Both" />
        </div>
        {report ? (
          <TimelineStrip start={c.from} end={c.to} sunWindows={report.sunWindows} earthWindows={report.earthWindows} highlight={metrics?.bestWindow} cells={40} ticks={0} size="sm" />
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
          <Button variant={best ? 'primary' : 'secondary'} to={missionUrl.date(c.site.id)}>
            Choose this site
          </Button>
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
          subtitle: site.kind === 'custom' ? 'Custom coordinates' : site.region.replace('-', ' '),
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

  return (
    <Page>
      <StepHeader
        step="compare"
        title="Compare"
        accent={compareBy === 'dates' ? 'dates' : 'sites'}
        back={{ to: missionUrl.chooseSite(siteIds), label: 'Change sites' }}
        aside={
          <>
            <Tabs
              label="Compare by"
              variant="pill"
              value={compareBy}
              onChange={(by) => navigate(missionUrl.compare(siteIds, by), { replace: true })}
              items={[
                { id: 'sites', label: 'Sites' },
                { id: 'dates', label: 'Dates' },
              ]}
            />
            {best?.m.bestWindow && (
              <div className={s.bestMatch}>
                <span className={s.label}>Best match</span>
                <span>
                  {best.c.site.name} · <span className="num">{formatUtc(best.m.bestWindow.start, false).slice(0, 6)}</span> —{' '}
                  <span className="num">{formatDuration(best.m.bestWindow.durationH)}</span> window
                </span>
              </div>
            )}
          </>
        }
      />

      <div className={s.cmpGrid}>
        {candidates.map((c, i) => (
          <CompareCard key={c.key} c={c} index={i} metrics={metrics[i]} best={i === bestIdx} />
        ))}
        {compareBy === 'sites' && candidates.length < MAX_COMPARE && (
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
      <OwnerNote owner="Aser (cards) · Pink (mini panoramas via drei View)">Step 3 placeholder. Match score formula is the engine's (Goda).</OwnerNote>
    </Page>
  );
}
