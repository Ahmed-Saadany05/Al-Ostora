/**
 * "Plan a future mission": Refaey leads, lightly. You are helping him plan his own Artemis landing near the south pole.
 *
 *  Step 1  He introduces the mission, then flies over to "South polar" and highlights it. Once it is open he points at
 *          three candidate sites and says why the pole matters (and why it is hard). You can ignore him and pick anything.
 *  Compare He asks which spot keeps him powered; stand on any of them to look around.
 *  Stand   Feedback on the site you are standing on: sunlight, longest night, Earth in view, and whether another of your
 *          picks would do better (all from the data hooks, nothing typed in).
 *  Landed  (Stand after touchdown) He runs into the 3D scene (see StandPage) and says what the Sun and Earth mean right now.
 *  Date    One line. Launch has its own touchdown card ("Could I do better?"), so he stays quiet there.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import type { PanelContent } from '@/screens/home/refaey/DialogueText';
import { useMetrics, useSites, useSky } from '@/shared/data';
import { formatDeg, formatDuration } from '@/shared/format';
import { resolveSite } from '@/shared/mission';
import { useTime } from '@/shared/store/time';
import { LUNAR, type Site, type SiteMetrics } from '@/shared/types';
import { RefaeyTalk } from './RefaeyTalk';
import s from './guide.module.css';

/** The three south-pole candidates he suggests (all have real LOLA terrain and skylines). */
export const SUGGESTED = ['connecting-ridge', 'shackleton-rim', 'mons-mouton'] as const;
const CANDIDATES_KEY = 'refaey-candidates';

const pct = (f: number) => `${Math.round(f * 100)}%`;

/** Mark elements for the highlight ring (and clear it again). */
function useHighlight(selectors: string[]) {
  const sel = selectors.join(',');
  useEffect(() => {
    if (!sel) return;
    let marked: Element[] = [];
    const mark = () => {
      marked.forEach((el) => el.removeAttribute('data-refaey-pick'));
      marked = [...document.querySelectorAll(sel)];
      marked.forEach((el) => el.setAttribute('data-refaey-pick', ''));
    };
    mark();
    const t = window.setInterval(mark, 500);
    return () => {
      window.clearInterval(t);
      marked.forEach((el) => el.removeAttribute('data-refaey-pick'));
    };
  }, [sel]);
}

/** Which region the Step 1 menu has open ('' = the region list). */
function useOpenRegion() {
  const [open, setOpen] = useState('');
  useEffect(() => {
    const read = () => setOpen(document.querySelector('[data-open-region]')?.getAttribute('data-open-region') ?? '');
    read();
    const t = window.setInterval(read, 300);
    return () => window.clearInterval(t);
  }, []);
  return open;
}

/** Fixed position just left of an element (he floats beside the menu). */
function useBeside(selector: string | null, dy = -30) {
  const [pos, setPos] = useState<CSSProperties | null>(null);
  useEffect(() => {
    if (!selector) return setPos(null);
    const place = () => {
      const el = document.querySelector(selector);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ position: 'fixed', right: window.innerWidth - r.left + 12, top: Math.max(80, r.top + dy) });
    };
    place();
    const t = window.setInterval(place, 500);
    window.addEventListener('resize', place);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('resize', place);
    };
  }, [selector, dy]);
  return pos;
}

// ---------------------------------------------------------------- Step 1

type Phase = 'intro' | 'point' | 'sites' | 'done';

function Step1Guide() {
  const openRegion = useOpenRegion();
  const [phase, setPhase] = useState<Phase>('intro');
  useEffect(() => {
    if (openRegion === 'south-pole' && (phase === 'intro' || phase === 'point')) setPhase('sites');
  }, [openRegion, phase]);

  const pointPos = useBeside(phase === 'point' ? '[data-region="south-pole"]' : null, -36);
  const sitesPos = useBeside(phase === 'sites' ? 'nav[data-open-region]' : null, 150);
  useHighlight(
    phase === 'point'
      ? ['[data-region="south-pole"]']
      : phase === 'sites'
        ? [...SUGGESTED.map((id) => `[data-site="${id}"]`), '[data-menu-footer] a', '[data-menu-footer] button']
        : [],
  );

  const content: PanelContent | null =
    phase === 'intro'
      ? {
          key: 'intro',
          title: 'Step 1 · Where?',
          lines: ['My next mission is an Artemis landing near the south pole, and I need your help choosing where.'],
          replies: [{ label: 'Where do we start?', next: 'point' }],
        }
      : phase === 'point'
        ? { key: 'point', title: 'Start here', lines: ['The south pole. Open it.'], replies: [] }
        : phase === 'sites'
          ? {
              key: 'sites',
              title: 'Three candidates',
              lines: [
                'Pick these three for me: Connecting Ridge, Shackleton Rim and Mons Mouton. Then press Compare.',
                'Why the pole? Craters here that never see the Sun may hold water ice, and the rocks may come from the Moon’s oldest giant impact basin.',
                'Why it’s hard: the Sun skims the horizon and Earth sits low, so a few metres of height decide whether I have power and a voice.',
              ],
              replies: [{ label: 'Got it', next: 'done' }],
            }
          : null;

  const style = phase === 'point' ? pointPos : phase === 'sites' ? sitesPos : null;
  if (!content) return null;
  return (
    <RefaeyTalk
      placement={style ? 'free' : 'top-left'}
      stacked={!style}
      reverse={!!style}
      style={style ?? undefined}
      className={s.moving}
      content={content}
      onReply={(r) => setPhase((r.next as Phase) ?? 'done')}
      height={style ? '110px' : '130px'}
      pose="float"
      entrance="none"
      balloonWidth={style ? 300 : 320}
    />
  );
}

// ---------------------------------------------------------------- Stand: feedback on the site

function useCandidateMetrics(ids: string[], catalogue: Site[] | undefined) {
  const from = useTime((st) => st.rangeStart);
  const to = useMemo(() => new Date(Date.parse(from) + LUNAR.synodicDays * 86_400_000).toISOString(), [from]);
  const sites = [0, 1, 2, 3].map((i) => (ids[i] ? resolveSite(ids[i], catalogue) : undefined));
  const m0 = useMetrics(sites[0], from, to).data;
  const m1 = useMetrics(sites[1], from, to).data;
  const m2 = useMetrics(sites[2], from, to).data;
  const m3 = useMetrics(sites[3], from, to).data;
  const m = [m0, m1, m2, m3];
  return sites.map((site, i) => (site && m[i] ? { site, m: m[i] as SiteMetrics } : null)).filter((x): x is { site: Site; m: SiteMetrics } => !!x);
}

function readCandidates(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(CANDIDATES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function StandGuide() {
  const [sp] = useSearchParams();
  const siteId = sp.get('site') ?? '';
  const { data: catalogue } = useSites();
  const ids = useMemo(
    () => [siteId, ...readCandidates(), ...(sp.get('others') ?? '').split(',')].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 4),
    [siteId, sp],
  );
  const all = useCandidateMetrics(ids, catalogue);
  const here = all.find((x) => x.site.id === siteId);
  const best = all.reduce<(typeof all)[number] | null>((b, x) => (!b || x.m.sunlitFraction > b.m.sunlitFraction ? x : b), null);

  const content: PanelContent = useMemo(() => {
    if (!here)
      return { key: 'stand-wait', title: 'Step 2 · Stand there', lines: ['Look around: find the Sun, then Earth. Drag to turn, and play the clock to watch a lunar day.'], replies: [] };
    const lines = [
      `${here.site.name}: sunlight ${pct(here.m.sunlitFraction)} of the lunar day, longest night ${formatDuration(here.m.longestNightH)}, Earth in view ${pct(here.m.earthVisibleFraction)}.`,
    ];
    if (best && best.site.id !== here.site.id && best.m.sunlitFraction - here.m.sunlitFraction >= 0.03)
      lines.push(
        `${best.site.name} gets ${pct(best.m.sunlitFraction)}: ${Math.round((best.m.sunlitFraction - here.m.sunlitFraction) * 100)} points more sunlight, longest night ${formatDuration(best.m.longestNightH)}. For power, that's the better pick.`,
      );
    else if (all.length > 1) lines.push('Of your picks, this one keeps me in sunlight the longest. Good call for power.');
    if (here.m.earthVisibleFraction < 0.5) lines.push('Watch Earth, though: it is hidden more than half the time here, so I would often be out of contact.');
    return { key: `stand-${here.site.id}-${best?.site.id}`, title: 'How this site would treat me', lines, replies: [{ label: 'Got it', next: 'close' }] };
  }, [here, best, all.length]);

  return (
    <RefaeyTalk
      placement="bottom-left"
      style={{ position: 'fixed', bottom: 'calc(var(--statusbar-height) + var(--space-5))' }}
      content={content}
      onReply={() => undefined}
      closeOnReply
      height="110px"
      pose="float"
      entrance="none"
      balloonWidth={360}
    />
  );
}

// ---------------------------------------------------------------- after touchdown (Stand ?landed=)

function LandedGuide() {
  const [sp] = useSearchParams();
  const { data: catalogue } = useSites();
  const site = resolveSite(sp.get('site') ?? '', catalogue);
  const time = useTime((st) => st.time);
  const { data: sky } = useSky(site, sp.get('at') ?? time);
  if (!site || !sky) return null;
  const pole = Math.abs(site.lat) >= 80;
  const lines = [
    sky.sunVisible
      ? `We're down. The Sun is ${formatDeg(sky.sun.elDeg, 1, false)} up and clears the skyline, so the panels are charging.`
      : `We're down, but the Sun is behind the terrain right now (${formatDeg(sky.sun.elDeg, 1, false)}). Batteries only, until it clears the ridge.`,
    sky.earthVisible ? `Earth is ${formatDeg(sky.earth.elDeg, 1, false)} up: we can talk home.` : `Earth is hidden (${formatDeg(sky.earth.elDeg, 1)}): no direct radio until it rises.`,
  ];
  if (pole) lines.push('Here both stay low, so a few hours, or a few metres, change all of this. Play the clock and watch.');
  return (
    <RefaeyTalk
      placement="bottom-left"
      style={{ position: 'fixed', bottom: 'calc(var(--statusbar-height) + var(--space-5))' }}
      figure={false}
      content={{ key: `landed-${site.id}`, title: `Touchdown · ${site.name}`, lines, replies: [{ label: 'Got it', next: 'close' }] }}
      onReply={() => undefined}
      closeOnReply
      balloonWidth={380}
    />
  );
}

// ---------------------------------------------------------------- layout

export function PlannerLayout() {
  const { pathname, search } = useLocation();
  const key = pathname.replace(/\/$/, '');
  const [sp] = useSearchParams();

  // Remember the sites being compared, so Stand can say how the one you stand on compares.
  useEffect(() => {
    if (key !== '/mission/compare') return;
    const ids = (sp.get('sites') ?? '').split(',').filter(Boolean);
    if (ids.length > 1)
      try {
        sessionStorage.setItem(CANDIDATES_KEY, JSON.stringify(ids));
      } catch {
        /* private mode */
      }
  }, [key, sp]);

  let guide = null;
  if (key === '/mission') guide = <Step1Guide />;
  else if (key === '/mission/stand') guide = sp.get('landed') ? <LandedGuide key={search} /> : <StandGuide key={search} />;
  else if (key === '/mission/compare' || key === '/mission/date')
    guide = (
      <RefaeyTalk
        key={key}
        placement="bottom-left"
        style={{ position: 'fixed', bottom: 'calc(var(--statusbar-height) + var(--space-5))' }}
        content={
          key === '/mission/compare'
            ? { key, title: 'Step 3 · Which one?', lines: ['Which spot keeps my batteries alive longest? Stand on any of them to look around, then pick.'], replies: [{ label: 'Got it', next: 'close' }] }
            : { key, title: 'Step 4 · When?', lines: ['Now the timing. Pick a date so I touch down with the Sun and Earth both up, and a long day ahead.'], replies: [{ label: 'Got it', next: 'close' }] }
        }
        onReply={() => undefined}
        closeOnReply
        autoFoldMs={7000}
        height="110px"
        pose="float"
        entrance="none"
        balloonWidth={320}
      />
    );

  return (
    <>
      <Outlet />
      {guide}
    </>
  );
}
