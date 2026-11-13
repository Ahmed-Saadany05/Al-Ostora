/**
 * /missions — "Three landings, three lessons". Owner: Hady.
 * A list of three past-mission cards; choosing one replaces the list (same area, no modal) with that story told as a
 * scripted conversation with Refaey. The open story lives in the URL (?story=id), so reload and Back/Forward work.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSites } from '@/shared/data';
import { missionUrl } from '@/shared/mission';
import { useApp } from '@/shared/store/app';
import { Button, Card, DisplayHeading, Lead } from '@/shared/ui';
import { ART, RefaeyBust } from '../refaey';
import { REFAEY_COPY } from '../refaey/copy';
import { MISSIONS, type Mission, type Reply } from '../refaey/dialogues/dialogues';
import { adaptReplies, resolveNode, type ResolveContext, type ResolvedNode } from '../refaey/logic';
import { getNode, hasExplainer } from '../refaey/registry';
import { MISSIONS_COPY } from './copy';
import s from './MissionsPage.module.css';
import r from '../refaey/refaey.module.css';

/** Stories use no data tokens and no conditions. */
const CONTEXT: ResolveContext = { horizons: false, values: {}, flags: {}, terminalLabel: REFAEY_COPY.ok, hasExplainer };
const HUB = 'missions-hub';
const FADE_MS = 240;

const yearOf = (iso: string) => iso.slice(0, 4);

type Trail = { missionId: string; ids: string[] };

export function MissionsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const motion = useApp((st) => st.motion);
  const { data: sites } = useSites();
  const mission = MISSIONS.find((m) => m.id === params.get('story')) ?? null;

  // The beats of the open conversation. Reset by construction whenever another story opens.
  const [trailState, setTrail] = useState<Trail>({ missionId: '', ids: [] });
  const ids = useMemo(
    () => (mission ? (trailState.missionId === mission.id ? trailState.ids : [mission.story[0].id]) : []),
    [mission, trailState],
  );

  const area = useRef<HTMLDivElement>(null);
  const beat = useRef<HTMLDivElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const cameFrom = useRef<string | null>(null);

  // A short opacity dissolve between list and story (same easing as the briefing's). None under reduced motion.
  const swap = useCallback(
    (change: () => void) => {
      const el = area.current;
      if (!el || !motion) return change();
      const out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-in-out', fill: 'forwards' });
      void out.finished.then(() => {
        change();
        requestAnimationFrame(() => {
          out.cancel();
          el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-in-out' });
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
    return node ? resolveNode(node, CONTEXT, (n) => getNode(n, backTo)) : null;
  };
  const currentId = ids[ids.length - 1];
  const previousId = ids[ids.length - 2];
  const current = mission && currentId ? resolve(currentId, previousId) : null;
  const earlier = ids.slice(0, -1).map((id, i) => resolve(id, ids[i - 1])).filter((n): n is ResolvedNode => n !== null);

  const onReply = (rep: Reply) => {
    if (!mission) return;
    if (rep.next === HUB) return closeStory();
    if (rep.next) {
      const next = rep.next;
      return setTrail({ missionId: mission.id, ids: next === previousId ? ids.slice(0, -1) : [...ids, next] });
    }
    const a = rep.action;
    if (a?.type === 'openExplainer') return setTrail({ missionId: mission.id, ids: [...ids, `explain:${a.id}`] });
    if (a?.type === 'openPlanner') return siteExists(a.siteId) ? navigate(missionUrl.stand(a.siteId)) : undefined;
    if (a?.type === 'navigate') return navigate(a.to === '/mission' ? missionUrl.chooseSite() : a.to);
  };

  const replies = current ? adaptReplies(current.replies, siteExists) : [];

  return (
    <div
      className={s.root}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && mission) {
          e.preventDefault();
          closeStory();
        }
      }}
    >
      <header className={s.head}>
        <DisplayHeading size="lg" align="left">
          {MISSIONS_COPY.title}
        </DisplayHeading>
        <Lead align="left">{MISSIONS_COPY.line}</Lead>
      </header>

      <div ref={area} className={s.area}>
        {!mission ? (
          <div className={[s.grid, s.list].join(' ')}>
            <div className={s.figure} aria-hidden>
              <RefaeyBust mood="neutral" size="var(--fig-bust)" />
            </div>
            <ul className={s.cards}>
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
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className={[s.grid, s.story].join(' ')}>
            <div className={s.back}>
              <Button variant="ghost" size="md" icon={null} onClick={closeStory}>
                ← {MISSIONS_COPY.all}
              </Button>
            </div>
            {earlier.length > 0 && (
              <div ref={history} className={s.history} role="region" aria-label={MISSIONS_COPY.earlier} tabIndex={0}>
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
            <div className={s.figure} aria-hidden>
              <img className={s.half} src={ART.pointing} width={596} height={560} alt="" draggable={false} />
            </div>
            <div className={s.current}>
              <div className={s.inlineBust} aria-hidden>
                <RefaeyBust mood={current?.mood ?? 'neutral'} size="var(--bust-inline)" />
              </div>
              <div className={s.say}>
                <div ref={beat} tabIndex={-1} className={s.beat} aria-live="polite">
                  {current?.title && <p className={s.beatTitle}>{current.title}</p>}
                  {current?.lines.map((l) => (
                    <p key={l} className={s.beatText}>
                      {l}
                    </p>
                  ))}
                </div>
                <div className={s.replies}>
                  {replies.map((rep) => (
                    <div key={rep.label} className={s.replyRow}>
                      {rep.note && <p className={s.note}>{rep.note}</p>}
                      <Button variant="ghost" size="md" icon="arrowRight" className={r.reply} onClick={() => onReply(rep)}>
                        {rep.label}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
