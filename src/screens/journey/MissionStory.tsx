/**
 * A past mission, told by Refaey while you stand on its real terrain at the touchdown minute.
 * Five short beats (arrive → why here → why now → one guess → the lesson). The hardware stands around you; click it.
 * The Sun and Earth are the recorded JPL Horizons positions (landingSky.json), not the app's live clock.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { lolaHorizon } from '@/data/horizons-lola';
import { SitePanorama, type SceneObject } from '@/scenes';
import type { PanelContent } from '@/screens/home/refaey/DialogueText';
import type { Reply } from '@/screens/home/refaey/dialogues/dialogues';
import { useSites } from '@/shared/data';
import { formatDeg, formatUtc } from '@/shared/format';
import { missionUrl } from '@/shared/mission';
import { Button, Icon, LoadingState } from '@/shared/ui';
import { RefaeyTalk } from './RefaeyTalk';
import { landingSkyState, placeFromSun } from './landingSkyState';
import { landingOf, missionById, modelUrl, PAST_MISSIONS, type PastMission } from './missions';
import s from './journey.module.css';

function fill(line: string, sunEl: number, earthEl: number) {
  return line.replace('{sun}', formatDeg(sunEl, 1, false)).replace('{earth}', formatDeg(earthEl, 1, false));
}

export function MissionStory() {
  const { id } = useParams();
  const mission = missionById(id);
  if (!mission) return <Navigate to="/missions" replace />;
  return <Story key={mission.id} mission={mission} />;
}

function Story({ mission }: { mission: PastMission }) {
  const navigate = useNavigate();
  const { data: sites } = useSites();
  const landing = landingOf(mission);
  const site = sites?.find((x) => x.id === landing.siteId);

  const horizon = useMemo(() => lolaHorizon(landing.siteId, landing.lat, landing.lon), [landing]);
  const sky = useMemo(() => landingSkyState(landing.siteId, landing, horizon), [landing, horizon]);
  const objects: SceneObject[] = useMemo(
    () =>
      mission.hardware.map((h) => ({
        id: h.id,
        url: modelUrl(h.model),
        label: h.label,
        yawDeg: h.yawDeg,
        rollDeg: h.rollDeg,
        ...placeFromSun(landing.sun.azDeg, h.fromSunDeg, h.distanceM),
      })),
    [mission, landing],
  );

  const [node, setNode] = useState<'where' | 'when' | 'guess' | 'lesson'>('where');
  const [answer, setAnswer] = useState<number | null>(null);
  const [picked, setPicked] = useState<string>();
  const [aim, setAim] = useState<{ azDeg: number; elDeg: number; key: number }>();
  const look = (b: 'sun' | 'earth' | 'site') => {
    const at = b === 'site' ? { azDeg: landing.sun.azDeg + 78, elDeg: -4 } : { azDeg: landing[b].azDeg, elDeg: Math.max(-10, landing[b].elDeg) };
    setAim({ ...at, key: Date.now() });
  };

  const next = PAST_MISSIONS[(PAST_MISSIONS.indexOf(mission) + 1) % PAST_MISSIONS.length];
  const hw = mission.hardware.find((h) => h.id === picked);
  const q = mission.question;

  // Only the moments that matter: where they landed, why at that moment (turn to the Sun and Earth), one guess, the lesson.
  const talk: PanelContent = useMemo(() => {
    const go = (label: string, next: string): Reply => ({ label, next });
    if (node === 'where')
      return { key: 'where', title: `${mission.name} · ${formatUtc(landing.time, false)}`, lines: [mission.arrive, mission.whyHere], replies: [go('And why land at that moment?', 'when')] };
    if (node === 'when')
      return {
        key: 'when',
        title: 'Why this moment',
        lines: [fill(mission.whyNow, landing.sun.elDeg, landing.earth.elDeg)],
        replies: [go('Show me the Sun', 'look:sun'), go('Where is Earth?', 'look:earth'), go('Got it', 'guess')],
      };
    if (node === 'guess') return { key: 'guess', title: 'Your guess', lines: [q.ask], replies: q.options.map((o, i) => go(o.label, `answer:${i}`)) };
    const right = answer !== null && q.options[answer].correct;
    return {
      key: 'lesson',
      title: right ? 'Right' : 'Not quite',
      lines: [right ? q.right : q.wrong, mission.lesson],
      replies: [go(`Next: ${next.name}`, 'next'), go('Plan a future mission', 'plan'), go('All missions', 'all')],
    };
  }, [node, answer, mission, landing, q, next]);

  const onReply = (r: Reply) => {
    const n = r.next ?? '';
    if (n === 'look:sun') return look('sun');
    if (n === 'look:earth') return look('earth');
    if (n.startsWith('answer:')) {
      setAnswer(Number(n.slice(7)));
      return setNode('lesson');
    }
    if (n === 'next') return navigate(`/missions/${next.id}`);
    if (n === 'plan') return navigate(missionUrl.chooseSite());
    if (n === 'all') return navigate('/missions');
    if (n === 'when' || n === 'guess') {
      if (n === 'when') look('sun');
      setNode(n);
    }
  };

  if (!site) return <LoadingState title="Landing…" />;

  return (
    <section className={s.stage}>
      <SitePanorama
        site={site}
        time={landing.time}
        fixedSky={sky}
        horizon={horizon}
        mode="stand"
        objects={objects}
        onObject={(oid) => setPicked((p) => (p === oid ? undefined : oid))}
        selectedObject={picked}
        initialYawDeg={landing.sun.azDeg + 78}
        aim={aim}
      />

      {/* Top-left: which landing, when, and the recorded sky. */}
      <div className={s.storyTitle}>
        <Button variant="secondary" leadingIcon="arrowLeft" icon={null} to="/missions">
          All missions
        </Button>
        <p className={s.eyebrow}>
          {mission.agency} · {formatUtc(landing.time)}
        </p>
        <h1 className={s.storyName}>{mission.name}</h1>
        <div className={s.readouts}>
          <button type="button" className={s.readout} onClick={() => look('sun')}>
            <Icon name="sun" size={14} /> Sun {formatDeg(landing.sun.elDeg, 1)}
          </button>
          <button type="button" className={s.readout} onClick={() => look('earth')}>
            <Icon name="earth" size={14} /> Earth {formatDeg(landing.earth.elDeg, 1)}
            {landing.earth.elDeg < 0 && <small> below the horizon</small>}
          </button>
          <span className={s.recorded} title={landing.timeSource}>
            JPL Horizons · recorded at touchdown
          </span>
        </div>
      </div>

      {/* Hardware fact, when a label is clicked. */}
      {hw && (
        <aside className={s.factCard} aria-live="polite">
          <button type="button" className={s.factClose} onClick={() => setPicked(undefined)} aria-label="Close">
            <Icon name="close" size={14} />
          </button>
          <p className={s.factTitle}>{hw.label}</p>
          <p className={s.factText}>{hw.fact}</p>
        </aside>
      )}

      {/* Refaey leads the story as a short conversation, bottom-left. */}
      <RefaeyTalk content={talk} onReply={onReply} height="min(30vh, 260px)" pose="stand" entrance="walk" />
    </section>
  );
}
