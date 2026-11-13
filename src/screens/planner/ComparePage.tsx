/**
 * STEP 3 — Compare. Owner: Aser.
 * Up to MAX_COMPARE sites over the same lunar day. (Date choices live in Step 4.)
 *
 * Layout (no cards): a "best match" headline, ONE shared time bar (play / scrub the lunar day),
 * then one vertical column per candidate: a live 3D scene (CompareScene3D, all scenes share one
 * <Canvas> via drei <View>), what you'd see at that moment, the match score with its meaning, the
 * key numbers with ★ on the best of each, and "Choose".
 * Values come from useMetrics / useDayReport / useHorizon; the page only picks the best per row.
 */
import { View } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDayReport, useHorizon, useMetrics } from '@/shared/data';
import { formatDuration, formatUtc } from '@/shared/format';
import { MAX_COMPARE, missionUrl, useMission } from '@/shared/mission';
import { LUNAR, type IsoTime, type Site, type SiteMetrics } from '@/shared/types';
import { Button, Drawer, EmptyState, Icon, IconButton, LoadingState, OwnerNote, Page, ProgressRing, StepHeader, Tabs } from '@/shared/ui';
import { EXAG, SiteScene } from './CompareScene3D';
import { useLunarDay } from './useLunarDay';
import { SettingsButton, usePlannerParams } from './SettingsDrawer';
import s from './flow.module.css';

interface Candidate {
  key: string;
  site: Site;
  from: IsoTime;
  to: IsoTime;
  name: string;
  subtitle: string;
}

const DAY_MS = LUNAR.synodicDays * 86_400_000;
const cls = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');
const pct = (f: number | undefined) => (f === undefined ? '—' : `${Math.round(f * 100)}%`);
const dur = (h: number | undefined) => (h === undefined ? '—' : h <= 0 ? 'none' : formatDuration(h));

/** What the match score means, in words (works for any number from any provider). */
const scoreWord = (v: number) => (v >= 80 ? 'Excellent' : v >= 60 ? 'Good' : v >= 40 ? 'Fair' : 'Poor');

/** Rows under the rings. (Sunlight, Earth link and Sun + Earth are shown as rings above.) */
const COLS = [
  { id: 'night', label: 'Longest darkness', hint: 'Longest stretch without sunlight: the battery must last this long', get: (m: SiteMetrics) => m.longestNightH, fmt: dur, better: 'low' },
  { id: 'gap', label: 'Longest silence', hint: 'Longest stretch without Earth in sight', get: (m: SiteMetrics) => m.longestCommsGapH, fmt: dur, better: 'low' },
] as const;
/** The three shares, drawn as rings (★ under the best one across columns). */
const RINGS = [
  { id: 'sun', label: 'Sunlight', tone: 'sun', get: (m: SiteMetrics) => m.sunlitFraction },
  { id: 'earth', label: 'Earth link', tone: 'earth', get: (m: SiteMetrics) => m.earthVisibleFraction },
  { id: 'both', label: 'Sun + Earth', tone: 'neutral', get: (m: SiteMetrics) => m.bothFraction },
] as const;
type ColId = (typeof COLS)[number]['id'] | (typeof RINGS)[number]['id'];

function usePrefersReducedMotion() {
  return useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
}

/** Ring that fills with the score (pathLength 100 → arc = score). */
function ScoreRing({ value }: { value: number | undefined }) {
  const v = Math.min(100, Math.max(0, value ?? 0));
  return (
    <span className={s.cxScore} title="Match score: how good this site and date are for landing (0–100)">
      <svg viewBox="0 0 56 56" className={s.cxRing} aria-hidden>
        <circle cx="28" cy="28" r="22" className={s.cxRingBg} />
        <circle cx="28" cy="28" r="22" pathLength={100} className={s.cxRingFg} style={{ strokeDasharray: `${v} 100` }} />
      </svg>
      <span className={s.cxScoreNum}>
        <span className="num">{value ?? '—'}</span>
        {value !== undefined && <span className={s.cxScoreWord}>{scoreWord(value)}</span>}
      </span>
    </span>
  );
}

const dayShort = (t: IsoTime | number) => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });

function Column({
  c,
  rank,
  m,
  bestCols,
  isBest,
  t,
  pickTo,
  still,
  delay,
  why,
  onRemove,
}: {
  c: Candidate;
  rank: number;
  m: SiteMetrics | undefined;
  bestCols: Set<ColId>;
  isBest: boolean;
  t: number;
  pickTo: string;
  still: boolean;
  delay: number;
  /** For the winner: why it is the best match, in plain words. */
  why?: string;
  /** Sites mode: remove this site from the comparison. */
  onRemove?: () => void;
}) {
  const params = usePlannerParams();
  const { data: report } = useDayReport(c.site, c.from, LUNAR.synodicDays, params);
  const { data: horizon } = useHorizon(c.site, params);
  const sample = report?.samples.length ? report.samples[Math.min(report.samples.length - 1, Math.round(t * (report.samples.length - 1)))] : undefined;
  return (
    <li className={cls(s.cqCol, isBest && s.cqColBest)} style={{ animationDelay: `${delay}ms` }}>
      {/* Live 3D scene (drawn by the shared canvas into this box's position). */}
      <View className={s.cqView}>
        <SiteScene sample={sample} horizon={horizon} still={still} />
      </View>

      <div className={s.cqHead}>
        <span className={cls(s.cxRank, 'num')}>{isBest ? '★' : rank}</span>
        <span className={s.cxNameText}>
          <strong title={c.name}>{c.name}</strong>
          <span>{c.subtitle}</span>
        </span>
        {onRemove && <IconButton icon="close" label={`Remove ${c.name}`} onClick={onRemove} className={s.cqRemove} />}
      </div>
      {why && <p className={s.cqWhy}>★ Best match: {why}</p>}

      <p className={s.cqNow}>
        <i className={cls(s.tlDot, sample?.sunVisible && s.tlDotSun)} /> {sample ? (sample.sunVisible ? 'Sunlit' : 'Dark') : '…'}
        <i className={cls(s.tlDot, sample?.earthVisible && s.tlDotEarth)} /> {sample ? (sample.earthVisible ? 'In contact' : 'No contact') : ''}
      </p>

      {/* Three rings: share of the lunar day with sunlight, with Earth, with both. */}
      <div className={s.cqRings}>
        {RINGS.map((r) => (
          <span key={r.id} className={s.cqRingCell}>
            <ProgressRing value={m ? r.get(m) : undefined} label={r.label} tone={r.tone} size={58} />
            {bestCols.has(r.id) && <span className={s.cxStar}>★ best</span>}
          </span>
        ))}
      </div>

      {/* Best window of this lunar day (Sun and Earth together). */}
      {report ? (
        <div className={s.cqStrip}>
          <p className={s.cqBestLine}>
            {m?.bestWindow ? (
              <>
                Best window <b className="num">{dayShort(m.bestWindow.start)}</b> · <b className="num">{formatDuration(m.bestWindow.durationH)}{m.bestWindow.clipped ? '+' : ''}</b>
              </>
            ) : m ? (
              'No time with Sun and Earth together'
            ) : (
              '…'
            )}
          </p>
        </div>
      ) : (
        <LoadingState compact />
      )}

      <ScoreRing value={m?.matchScore} />

      <dl className={s.cqStats}>
        {COLS.map((col) => {
          const best = bestCols.has(col.id);
          return (
            <div key={col.id} className={cls(s.cqStat, best && s.cqStatBest)} title={col.hint}>
              <dt>{col.label}</dt>
              <dd className="num">
                {m ? col.fmt(col.get(m)) : '—'}
                {best && <span className={s.cxStar}>★</span>}
              </dd>
            </div>
          );
        })}
      </dl>

      <Button variant={isBest ? 'primary' : 'secondary'} to={pickTo}>
        Choose
      </Button>
    </li>
  );
}

export function ComparePage() {
  const params = usePlannerParams();
  const navigate = useNavigate();
  const { sites, siteIds, compareBy, loading } = useMission();
  const { from } = useLunarDay();
  const still = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null!);

  const candidates: Candidate[] =
    compareBy === 'dates' && sites[0]
      ? [0, 1, 2].map((k) => {
          const f = new Date(Date.parse(from) + k * DAY_MS).toISOString();
          return {
            key: `${sites[0].id}@${k}`,
            site: sites[0],
            from: f,
            to: new Date(Date.parse(f) + DAY_MS).toISOString(),
            name: k === 0 ? 'This lunar day' : k === 1 ? 'Next lunar day' : 'In two lunar days',
            subtitle: `${sites[0].name} · ${formatUtc(f, false)}`,
          };
        })
      : sites.map((site) => ({
    key: site.id,
    site,
    from,
    to: new Date(Date.parse(from) + DAY_MS).toISOString(),
    name: site.name,
    subtitle: site.kind === 'custom' ? 'Custom coordinates' : site.region.replace('-', ' '),
  }));
  const dates = compareBy === 'dates';

  // Fixed number of hook calls (one per slot, up to 5) — rules of hooks.
  const m0 = useMetrics(candidates[0]?.site, candidates[0]?.from ?? from, candidates[0]?.to ?? from, params).data;
  const m1 = useMetrics(candidates[1]?.site, candidates[1]?.from ?? from, candidates[1]?.to ?? from, params).data;
  const m2 = useMetrics(candidates[2]?.site, candidates[2]?.from ?? from, candidates[2]?.to ?? from, params).data;
  const m3 = useMetrics(candidates[3]?.site, candidates[3]?.from ?? from, candidates[3]?.to ?? from, params).data;
  const m4 = useMetrics(candidates[4]?.site, candidates[4]?.from ?? from, candidates[4]?.to ?? from, params).data;
  const metrics = [m0, m1, m2, m3, m4];

  const rows = candidates.map((c, i) => ({ c, m: metrics[i] }));
  const scored = rows.filter((r) => r.m);
  const best = scored.length ? scored.reduce((a, b) => ((b.m!.matchScore ?? -1) > (a.m!.matchScore ?? -1) ? b : a)) : undefined;

  // Shared time: fraction 0…1 through the lunar day. Starts at the winner's best window.
  const [tState, setT] = useState<number | null>(null);
  const bestStartT = best?.m?.bestWindow ? Math.max(0, (Date.parse(best.m.bestWindow.start) - Date.parse(best.c.from)) / DAY_MS) : 0;
  const t = tState ?? bestStartT;
  const [playing, setPlaying] = useState(false);
  // "Add a site" opens a list right here (no trip back to Step 1).
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const { catalogue } = useMission();
  const setSites = (ids: string[]) => navigate(missionUrl.compare(ids, 'sites'), { replace: true });
  useEffect(() => {
    if (!playing) return;
    // 6 hours of lunar time per 100 ms → the whole lunar day in ~12 s.
    const id = setInterval(() => setT((v) => ((v ?? bestStartT) + 6 / (LUNAR.synodicDays * 24)) % 1), 100);
    return () => clearInterval(id);
  }, [playing, bestStartT]);

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

  const ordered = dates ? rows : [...rows].sort((a, b) => (b.m?.matchScore ?? -1) - (a.m?.matchScore ?? -1));

  // ★ the best value in each row (ties all get a star; nothing if everyone is equal).
  const bestCols = new Map<string, Set<ColId>>();
  rows.forEach((r) => bestCols.set(r.c.key, new Set()));
  if (scored.length > 1)
    for (const col of [...RINGS.map((r) => ({ ...r, better: 'high' as const })), ...COLS]) {
      const vals = scored.map((r) => col.get(r.m!));
      const target = col.better === 'high' ? Math.max(...vals) : Math.min(...vals);
      if (vals.every((v) => v === target)) continue;
      scored.forEach((r) => col.get(r.m!) === target && bestCols.get(r.c.key)!.add(col.id));
    }

  const why: string[] = [];
  if (best && scored.length > 1) {
    const won = bestCols.get(best.c.key)!;
    const m = best.m!;
    if (won.has('both')) why.push(`the most time with both the Sun and Earth (${pct(m.bothFraction)})`);
    if (won.has('sun')) why.push(`the most sunlight (${pct(m.sunlitFraction)})`);
    if (won.has('earth')) why.push(`the most time in contact (${pct(m.earthVisibleFraction)})`);
    if (won.has('night')) why.push(m.longestNightH > 0 ? `the shortest night (${dur(m.longestNightH)})` : 'no night at all');
    if (won.has('gap')) why.push(m.longestCommsGapH > 0 ? `the shortest silence (${dur(m.longestCommsGapH)})` : 'no silence at all');
  }
  // Dates: tell Step 4 which lunar day was chosen (?lunar=…), so it plans a launch inside it.
  const pickTo = (c: Candidate) => (dates ? `${missionUrl.date(c.site.id)}&lunar=${encodeURIComponent(c.from)}` : missionUrl.date(c.site.id));
  const timeLabel = dates ? `Day ${Math.round(t * LUNAR.synodicDays)} of each lunar day` : formatUtc(new Date(Date.parse(from) + t * DAY_MS).toISOString());
  const showAdd = !dates && candidates.length < MAX_COMPARE;
  const nCols = ordered.length + (showAdd ? 1 : 0);

  return (
    <div ref={root} className={s.cqRoot}>
      <Page>
        <StepHeader
          step="compare"
          title="Compare"
          accent={dates ? 'dates' : 'sites'}
          back={{ to: missionUrl.chooseSite(siteIds), label: 'Change sites' }}
          aside={
            <span className={s.headAside}>
              <SettingsButton />
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
            </span>
          }
        />

        {/* Best match summary: one line (the winner's column also glows and carries ★). */}
        {best && scored.length > 1 && (
          <div className={s.cqSummary}>
            <span className={s.cqSummaryStar}>★</span>
            <p className={s.cqSummaryText}>
              <span className={s.label}>Best match</span>
              <b>{best.c.name}</b>
              {dates && <> at {candidates[0].site.name}</>} · score <b className="num">{best.m!.matchScore}</b> {scoreWord(best.m!.matchScore)}
              {why.length > 0 && <> · {why.slice(0, 2).join(' and ')}</>}
              {best.m!.bestWindow && (
                <>
                  {' '}
                  · best window from <b className="num">{dayShort(best.m!.bestWindow.start)}</b>
                </>
              )}
            </p>
          </div>
        )}

        {/* One time bar for every site */}
        <section className={s.cqTime}>
          <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play the lunar day'} onClick={() => setPlaying((p) => !p)} active={playing} />
          <div className={s.cqTimeText}>
            <span className={s.label}>Every site at</span>
            <span className="num">{timeLabel}</span>
          </div>
          <input
            type="range"
            className={s.cqSlider}
            min={0}
            max={1000}
            value={Math.round(t * 1000)}
            onChange={(e) => {
              setPlaying(false);
              setT(Number(e.target.value) / 1000);
            }}
            aria-label="Time in the lunar day"
            aria-valuetext={timeLabel}
          />
          {best?.m?.bestWindow && (
            <Button
              variant="ghost"
              icon={null}
              leadingIcon="sun"
              onClick={() => {
                setPlaying(false);
                setT(bestStartT);
              }}
            >
              Best window
            </Button>
          )}
        </section>

        <p className={s.cxScoreNote}>
          <b>Match score (0–100):</b> how good a site and date are for landing. Higher means more sunlight for the solar panels, more time to talk to mission control, and
          shorter nights. ★ marks the best value in each row. In the 3D views, the ring is the real skyline around the lander (centre); solid rays mean the Sun or Earth
          is visible, dashed means blocked by terrain. Heights are stretched ×{EXAG} so small angles are visible. Drag a view to look around.
        </p>


        <ol className={s.cqGrid} style={{ gridTemplateColumns: `repeat(${nCols}, minmax(0, 1fr))` }}>
          {ordered.map((r, i) => (
            <Column
              key={r.c.key}
              c={r.c}
              rank={i + 1}
              m={r.m}
              bestCols={bestCols.get(r.c.key)!}
              isBest={!!best && r.c.key === best.c.key && scored.length > 1}
              t={t}
              pickTo={pickTo(r.c)}
              still={still}
              delay={i * 90}
              onRemove={!dates && candidates.length > 1 ? () => setSites(siteIds.filter((id) => id !== r.c.site.id)) : undefined}
            />
          ))}
          {showAdd && (
            <li className={s.cqAddCol}>
              <button type="button" className={s.cqAdd} onClick={() => setAdding(true)}>
                <Icon name="plus" size={22} />
                <span>Add a site</span>
                <span className="num">
                  {candidates.length} of {MAX_COMPARE}
                </span>
              </button>
            </li>
          )}
        </ol>

        <OwnerNote owner="Aser">Match score values come from the engine (Goda); the page explains what they mean, not the formula.</OwnerNote>

        <Drawer open={adding} onClose={() => setAdding(false)} eyebrow={`${candidates.length} of ${MAX_COMPARE} sites`} title="Add a site" next={null}>
          <input
            className={s.cqSearch}
            placeholder="Search sites…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search sites"
            autoFocus
          />
          <ul className={s.cqPick}>
            {(catalogue ?? [])
              .filter((x) => !siteIds.includes(x.id) && x.name.toLowerCase().includes(query.trim().toLowerCase()))
              .map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    className={s.cqPickItem}
                    disabled={siteIds.length >= MAX_COMPARE}
                    onClick={() => {
                      const next = [...siteIds, x.id];
                      setSites(next);
                      if (next.length >= MAX_COMPARE) setAdding(false);
                    }}
                  >
                    <strong>{x.name}</strong>
                    <span>{x.region.replace('-', ' ')}</span>
                    <Icon name="plus" size={14} />
                  </button>
                </li>
              ))}
          </ul>
          <p className={s.bodyLine}>
            Want a spot that isn't listed?{' '}
            <button type="button" className={s.cqLink} onClick={() => navigate(missionUrl.chooseSite(siteIds))}>
              Pick it on the Moon globe
            </button>
          </p>
        </Drawer>
      </Page>

      {/* ONE WebGL canvas for every 3D view on the page (drei View). Clicks/drags come from the page. */}
      <Canvas className={s.cqCanvas} eventSource={root} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
        <View.Port />
      </Canvas>
    </div>
  );
}
