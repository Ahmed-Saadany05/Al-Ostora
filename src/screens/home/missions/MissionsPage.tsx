/**
 * /missions — "Three landings, three lessons". Owner: Hady.
 * A list of three past-mission cards; choosing one replaces the list (same area, no modal) with that story told as a
 * scripted conversation with Refaey. The open story lives in the URL (?story=id), so reload and Back/Forward work.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getProvider, useSites } from '@/shared/data';
import { missionUrl } from '@/shared/mission';
import { useApp } from '@/shared/store/app';
import { Button, Card, DisplayHeading, Icon, Lead } from '@/shared/ui';
import { RefaeyBust } from '../refaey';
import { refaeyActor } from '../refaey/actorBus';
import { RefaeyActor, useQuip } from '../refaey/RefaeyActor';
import { RefaeyStage } from '../refaey/RefaeyStage';
import { MISSIONS_LIST_SLOTS, MISSIONS_STORY_SLOTS } from '../refaey/slots';
import { FactsBadge } from '../refaey/FactsBadge';
import { athenaVerdict, recordedTokens } from '../refaey/facts/display';
import { REFAEY_COPY } from '../refaey/copy';
import { advance, isSideNode } from '../refaey/conversation';
import { HUB, MISSIONS, type Mission, type Reply } from '../refaey/dialogues/dialogues';
import { SourceLink } from '../refaey/SourceLink';
import { useRefaey } from '../refaey/store';
import { adaptReplies, resolveNode, type ResolveContext, type ResolvedNode } from '../refaey/logic';
import { getNode, hasExplainer } from '../refaey/registry';
import type { PanelContent } from '../refaey/DialogueText';
import { MISSIONS_COPY } from './copy';
import s from './MissionsPage.module.css';
import r from '../refaey/refaey.module.css';

/** Stories read no live values. They read the recorded Horizons facts (history), which fill on every provider, and the story's callsign. */
const baseContext = (callsign: string): ResolveContext => ({
  horizons: false,
  values: {},
  flags: {
    athenaSunlit: athenaVerdict() === 'sunlit',
    athenaHidden: athenaVerdict() === 'hidden',
  },
  facts: recordedTokens(),
  story: { callsign },
  terminalLabel: REFAEY_COPY.ok,
  hasExplainer,
});
const HUB_ID = 'missions-hub';
const FADE_MS = 240;

const yearOf = (iso: string) => iso.slice(0, 4);

type Trail = { missionId: string; ids: string[] };

export function MissionsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const motion = useApp((st) => st.motion);
  const { data: sites } = useSites();
  const callsign = useRefaey((st) => st.callsign);
  const lessons = useRefaey((st) => st.lessons);
  const learn = useRefaey((st) => st.learn);
  const quip = useQuip();
  const context = useMemo(() => baseContext(callsign), [callsign]);
  const say = (text: string) => text.replaceAll('{callsign}', callsign);
  const mission = MISSIONS.find((m) => m.id === params.get('story')) ?? null;

  // The beats of the open conversation. Reset by construction whenever another story opens.
  const [trailState, setTrail] = useState<Trail>({ missionId: '', ids: [] });
  const ids = useMemo(() => (mission ? (trailState.missionId === mission.id ? trailState.ids : [mission.story[0].id]) : []), [mission, trailState]);

  const area = useRef<HTMLDivElement>(null);
  const pageRoot = useRef<HTMLDivElement>(null);
  // 'on' while he is being placed in the screen; 'off' when no slot fits and the plain layout shows. Reset when the list/story changes.
  const [placed, setPlaced] = useState<{
    view: string;
    ok: boolean;
    pose: string | null;
  }>({ view: '', ok: true, pose: null });
  const view = mission ? `story:${mission.id}` : 'list';
  const stage = placed.view !== view || placed.ok ? 'on' : 'off';
  const plain = stage === 'off'; // the plain layout (no Refaey in the screen) is only rendered when nothing fit
  const pendingHop = useRef(false);
  const beat = useRef<HTMLDivElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const cameFrom = useRef<string | null>(null);

  // A short opacity dissolve between list and story (same easing as the briefing's). None under reduced motion.
  const swap = useCallback(
    (change: () => void) => {
      const el = area.current;
      if (!el || !motion) return change();
      const out = el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: FADE_MS,
        easing: 'ease-in-out',
        fill: 'forwards',
      });
      void out.finished.then(() => {
        change();
        requestAnimationFrame(() => {
          out.cancel();
          el.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: FADE_MS,
            easing: 'ease-in-out',
          });
        });
      });
    },
    [motion],
  );

  const openStory = (m: Mission) => {
    cameFrom.current = m.id;
    swap(() => {
      setTrail({ missionId: m.id, ids: [m.story[0].id] });
      setParams({ story: m.id });
    });
  };
  const closeStory = useCallback(() => swap(() => setParams({})), [swap, setParams]);

  // Focus: the new beat after every reply; the card you came from when you return to the list.
  const last = useRef({ story: '', beats: 0 });
  useLayoutEffect(() => {
    const now = { story: mission?.id ?? '', beats: ids.length };
    if (mission && (last.current.story !== now.story || last.current.beats !== now.beats)) beat.current?.focus({ preventScroll: true });
    if (!mission && last.current.story) {
      document.querySelector<HTMLElement>(`[data-story="${last.current.story}"] button`)?.focus({ preventScroll: true });
    }
    last.current = now;
  });
  // Keep the newest of the earlier beats in view inside their small scroll area (the page itself never jumps).
  useLayoutEffect(() => {
    const h = history.current;
    if (h) h.scrollTop = h.scrollHeight;
  }, [ids.length]);

  const siteExists = useCallback((id: string) => !sites || sites.some((x) => x.id === id), [sites]);

  const resolve = (id: string, backTo?: string): ResolvedNode | null => {
    const node = getNode(id, backTo);
    return node ? resolveNode(node, context, (n) => getNode(n, backTo)) : null;
  };
  const currentId = ids[ids.length - 1];
  const previousId = ids[ids.length - 2];
  const current = mission && currentId ? resolve(currentId, previousId) : null;
  const earlier = ids
    .slice(0, -1)
    .map((id, i) => resolve(id, ids[i - 1]))
    .filter((n): n is ResolvedNode => n !== null);

  // Finishing a story puts its lesson in the notebook.
  const finished = current?.learns && mission ? mission.lessonKey : null;
  useEffect(() => {
    if (!finished) return;
    learn(finished);
    pendingHop.current = true; // back on the list he hops once if he is standing; in the plain layout he hops now
    if (stage === 'off') refaeyActor.hop(); // a lesson learned: he hops (only if he may move)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, learn]);
  useEffect(() => {
    if (mission || !pendingHop.current || placed.view !== 'list' || !placed.ok) return;
    pendingHop.current = false;
    if (placed.pose !== 'stand') return;
    const t = window.setTimeout(() => refaeyActor.hop(), 1400);
    return () => window.clearTimeout(t);
  }, [mission, placed]);

  const onReply = (rep: Reply) => {
    if (!mission) return;
    if (rep.next === HUB_ID) return closeStory();
    const step = advance(ids, rep);
    if (step.ids !== ids) return setTrail({ missionId: mission.id, ids: step.ids });
    const a = step.action;
    if (a?.type === 'openPlanner') return siteExists(a.siteId) ? navigate(missionUrl.stand(a.siteId, a.at)) : undefined;
    // "OK" on an explainer goes back to the story beat it was opened from.
    if (a?.type === 'collapse' && isSideNode(currentId)) return setTrail({ missionId: mission.id, ids: ids.slice(0, -1) });
    if (a?.type === 'navigate') return navigate(a.to === '/mission' ? missionUrl.chooseSite() : a.to);
  };

  const allLearned = MISSIONS.every((m) => lessons[m.lessonKey]);
  const replies = current ? adaptReplies(current.replies, siteExists, getProvider().id === 'live') : [];

  const stageContent: PanelContent =
    mission && current
      ? {
          key: current.id,
          title: current.title,
          lines: current.lines,
          replies,
          link: current.link,
        }
      : {
          key: 'hub',
          lines: [say(allLearned ? HUB.allLearned : HUB.idle)],
          replies: [],
        };

  return (
    <div
      ref={pageRoot}
      className={s.root}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && mission && stage === 'off') {
          e.preventDefault();
          closeStory();
        }
      }}
    >
      <header className={[s.head, mission && s.headStory].filter(Boolean).join(' ')}>
        <DisplayHeading size="lg" align="left">
          {HUB.title}
        </DisplayHeading>
        {/* The "pick one" line is for the list; an open story needs the room for the conversation. */}
        {!mission && <Lead align="left">{say(HUB.subtitle)}</Lead>}
      </header>

      <RefaeyStage
        key={view}
        slots={mission ? MISSIONS_STORY_SLOTS : MISSIONS_LIST_SLOTS}
        scope={pageRoot}
        content={stageContent}
        footer={mission && current?.usesFacts ? <FactsBadge /> : undefined}
        onReply={mission ? onReply : () => undefined}
        entrance="none"
        reserveH={mission ? undefined : 120}
        onPlaced={(ok, slot) =>
          setPlaced((p) => (p.view === view && p.ok === ok && p.pose === (slot?.pose ?? null) ? p : { view, ok, pose: slot?.pose ?? null }))
        }
      />
      <div ref={area} className={s.area}>
        {!mission ? (
          <div className={[s.grid, s.list].join(' ')}>
            {plain && (
              <div className={s.figure} data-refaey-fallback>
                <RefaeyActor height="var(--actor-h)" clickable />
              </div>
            )}
            <div className={s.listBody}>
              <div className={s.idle}>
                {plain && (
                  <div className={s.quipHost} data-quip={quip !== null}>
                    <p className={s.idleText}>{say(allLearned ? HUB.allLearned : HUB.idle)}</p>
                    {quip && (
                      <p className={s.quipLine} role="status">
                        {quip}
                      </p>
                    )}
                  </div>
                )}
                {allLearned && (
                  <Button variant="primary" size="md" to={missionUrl.chooseSite()}>
                    {say(HUB.plan)}
                  </Button>
                )}
              </div>
              <ul className={s.cards} data-refaey-anchor="cards">
                {MISSIONS.map((m) => (
                  <li key={m.id} data-story={m.id} className={s.cardItem}>
                    <Card onSelect={() => openStory(m)} padding="md" className={s.card}>
                      <span className={s.cardTitle}>{m.name}</span>
                      <span className={s.cardMeta}>
                        {m.agency} · <span className="num">{m.years ?? yearOf(m.landed)}</span>
                      </span>
                      <span className={s.cardTag}>
                        <span className="visually-hidden">{MISSIONS_COPY.lesson}: </span>
                        {MISSIONS_COPY.lessons[m.lesson]}
                      </span>
                      <span className={s.cardLine}>{m.outcome}</span>
                      {lessons[m.lessonKey] && (
                        <span className={s.learned}>
                          <Icon name="check" size={14} /> {HUB.learned}
                        </span>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className={[s.grid, s.story].join(' ')}>
            <div className={s.back} data-refaey-anchor="back">
              <Button variant="ghost" size="md" icon={null} onClick={closeStory}>
                ← {MISSIONS_COPY.all}
              </Button>
            </div>
            {plain && earlier.length > 0 && (
              <div ref={history} data-refaey-fallback className={s.history} role="region" aria-label={MISSIONS_COPY.earlier} tabIndex={0}>
                {earlier.map((n, i) => (
                  <div key={`${n.id}:${i}`} className={s.earlier}>
                    {n.title && <p className={s.beatTitle}>{n.title}</p>}
                    {n.lines.map((l) => (
                      <p key={l} className={s.beatText}>
                        {l}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {plain && (
              <>
                <div className={s.figure} data-refaey-fallback>
                  <RefaeyActor height="var(--actor-h)" clickable />
                </div>
                <div className={s.current} data-refaey-fallback>
                  <div className={s.inlineBust} aria-hidden>
                    <RefaeyBust mood={current?.mood ?? 'neutral'} size="var(--bust-inline)" />
                  </div>
                  <div className={s.say}>
                    <div ref={beat} tabIndex={-1} className={[s.beat, s.quipHost].join(' ')} aria-live="polite" data-quip={quip !== null}>
                      {quip && (
                        <p className={s.quipLine} role="status">
                          {quip}
                        </p>
                      )}
                      {current?.title && <p className={s.beatTitle}>{current.title}</p>}
                      {current?.lines.map((l) => (
                        <p key={l} className={s.beatText}>
                          {l}
                        </p>
                      ))}
                      {current?.link && <SourceLink link={current.link} />}
                      {current?.usesFacts && (
                        <div className={s.source}>
                          <FactsBadge />
                        </div>
                      )}
                    </div>
                    <div className={s.replies}>
                      {replies.map((rep) => (
                        <div key={rep.label} className={s.replyRow}>
                          <Button variant="ghost" size="md" icon="arrowRight" className={r.reply} onClick={() => onReply(rep)}>
                            {rep.label}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
