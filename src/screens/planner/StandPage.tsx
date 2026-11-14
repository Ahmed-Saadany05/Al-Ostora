/**
 * STEP 2 — Stand on site. Owner: Aser (HUD) + Pink (Moon view).
 *
 * Full-screen 3D Moon view (SitePanorama) with the overlays tucked into edge drawers (PeekPanel):
 * right = Sun, Earth and How far away; left = Nearby; bottom = the timeline. Hover to peek, click to
 * pin. "Compare side by side" shows two Moon views (?with=<site id>). Launch → the launch-date step.
 * Numbers come only from the data hooks (demo provider now, the engine later).
 *
 * URL extras (Pink): ?at=ISO opens the view at that moment; ?others=a,b,c (from Compare sites) makes
 * the back button "View other sites"; ?landed=<launch ISO> (after "Tap the Moon to land") swaps
 * Launch for "Summarize trip". The timeline (Aser's) sweeps to a clicked moment (timelapse) and
 * follows a drag directly; the cards read the sky blended from the day's samples, so they keep up.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { interpolateSky, preloadMissionGlobe, SitePanorama } from '@/scenes';
import { Explain } from '@/screens/home/Explain';
import { useDayReport, useHorizon, useMetrics, useSites, useSky } from '@/shared/data';
import { formatDeg, formatLatLon, formatNumber, formatUtc } from '@/shared/format';
import { missionUrl, useMission } from '@/shared/mission';
import { cancelTimelapse, timelapseTo } from '@/shared/store/timelapse';
import { useTime } from '@/shared/store/time';
import { LUNAR, type Site, type IsoTime, type TimeWindow } from '@/shared/types';
import {
  Button,
  EmptyState,
  Eyebrow,
  Icon,
  IconButton,
  LoadingState,
  Page,
  Pill,
  SourceBadge,
  Tabs,
} from '@/shared/ui';
import { PeekPanel } from './stand/PeekPanel';
import { SideBySide } from './stand/SideBySide';
import { BodyCard, HowFarCard, NearbyCard } from './stand/StandCards';
import { useLunarDay } from './useLunarDay';
import { VerifyDrawer } from './VerifyDrawer';
import { SettingsButton, usePlannerParams } from './SettingsDrawer';
import { StandTimeline } from './standTimeline';
import fs from './flow.module.css';
import st from './stand/stand.module.css';

/** Great-circle distance on the Moon, km. */
function moonKm(a: Site, b: Site) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * LUNAR.radiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function StandPage() {
  const lander = usePlannerParams(); // Lander settings (Aser) feed every data hook below.
  const pauseClock = useTime((x) => x.pause);
  const { site, loading } = useMission();
  const { data: catalogue } = useSites();
  const [params, setParams] = useSearchParams();
  const { from, to, days } = useLunarDay();
  const time = useTime((x) => x.time);
  const playing = useTime((x) => x.playing);
  const toggle = useTime((x) => x.toggle);
  const setTime = useTime((x) => x.setTime);
  const [mode, setMode] = useState<'stand' | 'above'>('stand');
  const [verify, setVerify] = useState(false);

  const { data: fetchedSky } = useSky(site, time, lander);
  const { data: horizon } = useHorizon(site, lander);
  const { data: report } = useDayReport(site, from, days, lander);
  // Blend the day's samples on the client, so the cards keep up while scrubbing or in a timelapse.
  const sky = useMemo(() => interpolateSky(report?.samples, time) ?? fetchedSky, [report, time, fetchedSky]);
  const { data: metrics } = useMetrics(site, from, to, lander);

  // Nearby: placeholder suggestion = the closest other catalogue site (the engine suggests one later).
  const nearby = useMemo(() => {
    if (!site || !catalogue) return undefined;
    let best: { site: Site; km: number } | undefined;
    for (const c of catalogue) {
      if (c.id === site.id) continue;
      const km = moonKm(site, c);
      if (!best || km < best.km) best = { site: c, km };
    }
    return best;
  }, [site, catalogue]);
  const { data: nearbyMetrics } = useMetrics(nearby?.site, from, to, lander);

  const withId = params.get('with');
  const partner = withId ? catalogue?.find((c) => c.id === withId) : undefined;
  const setWith = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('with', id);
    else next.delete('with');
    setParams(next, { replace: true });
  };

  // ?at=ISO: open the view at that moment (once per link), e.g. touchdown after landing.
  const at = params.get('at');
  useEffect(() => {
    if (at) setTime(at);
  }, [at, setTime]);
  // ?others=a,b,c: arrived from Compare sites → the back button returns there.
  const others = (params.get('others') ?? '').split(',').filter(Boolean);
  // ?landed=<launch ISO>: arrived after landing → "Summarize trip" instead of Launch.
  const landedRaw = params.get('landed');
  const landed = landedRaw && Number.isFinite(Date.parse(landedRaw)) ? landedRaw : null;
  // After landing, the summary is next: have its real Moon ready before "Summarize trip".
  useEffect(() => {
    if (landed && site) void preloadMissionGlobe(site.lat, site.lon);
  }, [landed, site]);

  // Timeline picks: a single pick (click, the best-window tag, a key press) sweeps there; the rapid
  // updates of a drag (< 120 ms apart) follow the pointer directly.
  const lastPick = useRef(0);
  const pickTime = (ms: number) => {
    const now = performance.now();
    const dragging = now - lastPick.current < 120;
    lastPick.current = now;
    if (dragging) {
      cancelTimelapse();
      setTime(ms);
    } else timelapseTo(ms);
  };

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

  // Countdowns from the report's Sun / Earth WINDOWS, not the hourly samples (Goda's review #7):
  // the live engine refines window edges to ~±15 s, so these are minute-accurate. They are relative
  // to the clock `time` (which moves when you play / scrub), unlike useMetrics' next*, which are
  // relative to the start of the lunar day.
  //   up now  → the end of the window you are in (null if it runs past this lunar day)
  //   down now → the start of the next window (null if none before this lunar day ends)
  const nextChange = (windows: TimeWindow[] | undefined, up: boolean): IsoTime | null => {
    if (!windows) return null;
    const t = Date.parse(time);
    if (up) {
      const w = windows.find((x) => Date.parse(x.start) <= t && t <= Date.parse(x.end));
      return w && !(w.clipped && Date.parse(w.end) >= Date.parse(to) - 60_000) ? w.end : null;
    }
    return windows.find((x) => Date.parse(x.start) > t)?.start ?? null;
  };
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
    <section className={st.stage}>
      {/* The Moon view fills the whole stage; everything else floats over it. */}
      {partner ? (
        <SideBySide
          left={site}
          right={partner}
          choices={catalogue ?? []}
          mode={mode}
          onPick={(id) => setWith(id)}
          onClose={() => setWith(null)}
        />
      ) : (
        <SitePanorama site={site} time={time} sky={sky} horizon={horizon} mode={mode} />
      )}

      {/* Top-left: where you are. */}
      {!partner && (
        <div className={st.titleBlock}>
          <Button
            variant="secondary"
            leadingIcon="arrowLeft"
            icon={null}
            to={others.length > 0 ? missionUrl.compare(others, 'sites') : missionUrl.chooseSite([site.id])}
          >
            {others.length > 0 ? 'View other sites' : 'Back to sites'}
          </Button>
          <Eyebrow>
            {site.region.replace('-', ' ')} · <span className="num">{formatLatLon(site.lat, site.lon)}</span>
          </Eyebrow>
          <h1 className={st.title}>{site.name}</h1>
          <div className={st.statusRow}>
            <Pill tone={sky?.sunVisible ? 'sun' : 'neutral'} icon={sky?.sunVisible ? 'sun' : 'moon'} label={status} />
            {site.region === 'farside' ? <Explain id="farside" /> : site.region === 'south-pole' ? <Explain id="low-sun" /> : <Explain id="libration" />}
          </div>
        </div>
      )}

      {/* Top-centre: view toggle. */}
      <div className={st.viewToggle}>
        <SettingsButton />
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
      </div>

      {/* Right: Sun, Earth, How far away. */}
      {sky && !partner && (
        <PeekPanel
          side="right"
          label="Sun, Earth and distances"
          tab={
            <span className={st.tabStack}>
              <span className={st.tabVal}>
                <Icon name="sun" size={14} /> <span className="num">{formatDeg(sky.sun.elDeg, 1)}</span>
              </span>
              <span className={st.tabVal}>
                <Icon name="earth" size={14} /> <span className="num">{formatDeg(sky.earth.elDeg, 1)}</span>
              </span>
              <span className={st.tabVal}>
                <Icon name="antenna" size={14} /> <span className="num">{formatNumber(sky.earth.distanceKm / 1000, 0)}k km</span>
              </span>
            </span>
          }
        >
          <BodyCard kind="sun" body={sky.sun} visible={sky.sunVisible} now={time} next={nextChange(report?.sunWindows, sky.sunVisible)} source={sky.source} />
          <BodyCard kind="earth" body={sky.earth} visible={sky.earthVisible} now={time} next={nextChange(report?.earthWindows, sky.earthVisible)} source={sky.source} />
          <HowFarCard earthKm={sky.earth.distanceKm} sunKm={sky.sun.distanceKm} source={sky.source} />
        </PeekPanel>
      )}

      {/* Left: Nearby. */}
      {nearby && !partner && (
        <PeekPanel
          side="left"
          label="Nearby site"
          tab={
            <span className={st.tabStack}>
              <span className={st.tabVal}>
                <Icon name="compare" size={14} /> Nearby
              </span>
            </span>
          }
        >
          <NearbyCard site={nearby.site} metrics={nearbyMetrics} distanceKm={nearby.km} onCompare={() => setWith(nearby.site.id)} />
        </PeekPanel>
      )}

      {/* Bottom: the timeline. */}
      <PeekPanel
        side="bottom"
        label="Timeline"
        tab={
          <span className={st.tabRow}>
            <Icon name={playing ? 'pause' : 'clock'} size={14} />
            <span className="num">{formatUtc(time)}</span>
          </span>
        }
      >
        {/* Slim time dock (Aser): one line of controls over the ribbons, no box. */}
        <section className={st.timeline}>
          <div className={st.timelineHead}>
            <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} onClick={toggle} active={playing} />
            <span className={fs.dockTime}>
              <span className="num">{formatUtc(time)}</span>
            </span>
            <span className={st.grow} />
            {metrics?.bestWindow && (
              <button type="button" className={fs.dockLink} onClick={() => timelapseTo(metrics.bestWindow!.start)}>
                <Icon name="sun" size={14} /> Jump to best
              </button>
            )}
            <span className={fs.explainUp}>
              <Explain id="best-window" />
            </span>
            <Link className={fs.dockLink} to={missionUrl.chooseSite([site.id])}>
              <Icon name="plus" size={14} /> Compare
            </Link>
            <button type="button" className={fs.dockLink} onClick={() => setVerify(true)}>
              <Icon name="orbit" size={14} /> Check against JPL Horizons
            </button>
            {sky && <SourceBadge source={sky.source} />}
          </div>
          {report ? (
            <StandTimeline
              from={from}
              to={to}
              samples={report.samples}
              stepMinutes={report.stepMinutes}
              now={time}
              best={metrics?.bestWindow ?? null}
              onSelect={pickTime}
              onScrubStart={pauseClock}
              slim
            />
          ) : (
            <LoadingState compact />
          )}
        </section>
      </PeekPanel>

      {/* Always visible: the step's one primary action. */}
      <div className={st.launch}>
        {landed ? (
          <Button variant="primary" size="lg" to={missionUrl.launch(site.id, landed, true)}>
            Summarize trip
          </Button>
        ) : (
          <Button variant="primary" size="lg" to={missionUrl.date(site.id)}>
            Launch
          </Button>
        )}
      </div>

      <VerifyDrawer site={site} time={time} open={verify} onClose={() => setVerify(false)} />
    </section>
  );
}
