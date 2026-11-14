import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/shared/store/app';
import sprites from './art/sprites.json';
import idleStrip from './art/idle-strip.webp';
import walkStrip from './art/walk-strip.webp';
import hopStrip from './art/hop-strip.webp';
import { refaeyActor } from './actorBus';
import { QUIPS } from './copy';
import { DRIFT_IN_MS, driftInProgress, floatCycle, floatDrift, FLOAT_FRAME_MS, frameAt, hopLiftPx, hopTimeline, idleCycle, IDLE_FRAME_MS, PUSH_MS, pushOffset, WALK_FRAME_MS, WALK_IN_MAX_S, type Anim } from './spriteMath';
import { useRefaey } from './store';
import s from './refaey.module.css';

const STRIPS: Record<Anim, string> = { idle: idleStrip, walk: walkStrip, hop: hopStrip };
const SPEC = sprites as unknown as Record<Anim, { frameW: number; frameH: number; count: number; anchorX: number }>;
/** One box fits every strip with the feet and the chest on the same spot, so changing animation never shifts him. */
const LEFT = Math.max(...(['idle', 'walk', 'hop'] as Anim[]).map((a) => SPEC[a].anchorX));
const RIGHT = Math.max(...(['idle', 'walk', 'hop'] as Anim[]).map((a) => SPEC[a].frameW - SPEC[a].anchorX));
const BOX_W = LEFT + RIGHT;
const BOX_H = Math.max(...(['idle', 'walk', 'hop'] as Anim[]).map((a) => SPEC[a].frameH));
/** Width / height of his box (the same for every pose), for the placement engine. */
export const ACTOR_ASPECT = BOX_W / BOX_H;
/** Transparent rows under the boots in each strip (measured on the art): the sprite is lowered by this so his feet are exactly on the ground line. */
const FEET_GAP: Record<Anim, number> = { idle: 5, walk: 5, hop: 6 };
const HOP_COOLDOWN_MS = 3000;
const QUIP_MS = 2000;

/** True while Refaey may move: the app's Motion toggle is on, the system does not ask for reduced motion, and the tab is visible. */
function useMayAnimate() {
  const motion = useApp((st) => st.motion);
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = () => setReduced(mq.matches);
    const onVis = () => setVisible(document.visibilityState !== 'hidden');
    mq.addEventListener('change', onMq);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      mq.removeEventListener('change', onMq);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return { motionOn: motion && !reduced, visible };
}

/**
 * Refaey's full-body sprite, in his own box (width and height are reserved by an aspect ratio, so nothing shifts).
 * One animation plays at a time: idle (a gentle loop), a walk in from the left edge (once per session, on request), or a hop
 * under lunar gravity. Motion off (the app's toggle or the system setting) shows the first idle frame, still.
 * The box takes its height from `height` (any CSS length) and is aria-hidden: everything it means is in the text.
 */
/** What he is saying because he was poked (null most of the time): a page shows it in his text area for two seconds. */
export function useQuip() {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => refaeyActor.onSay(setLine), []);
  return line;
}

export type ActorPose = 'stand' | 'float';

/**
 * pose 'stand': idle / walk / hop on a surface (his feet are the bottom of the box). pose 'float': the airborne frames of the hop sheet
 * with a slow drift (translateY ±4 px, rotate ±1.5° over 4 s); a click pushes him 12 px away and back instead of a hop.
 * entrance 'walk' (standing, once per session) or 'drift' (floating in from beyond the left edge, ≤ 1.2 s, once per session): `onEntered`
 * fires when it is over (at once when there is no entrance). `driftPaused` freezes the drift (while the balloon animates in).
 * `onActivate` makes him a real button (keyboard and screen readers) with the given label.
 */
export function RefaeyActor({
  height,
  walkIn = false,
  clickable = false,
  pose = 'stand',
  entrance = 'none',
  driftPaused = false,
  onEntered,
  onActivate,
  activateLabel,
}: {
  height: string;
  walkIn?: boolean;
  clickable?: boolean;
  pose?: ActorPose;
  entrance?: 'none' | 'walk' | 'drift';
  driftPaused?: boolean;
  onEntered?: () => void;
  onActivate?: () => void;
  activateLabel?: string;
}) {
  const { motionOn, visible } = useMayAnimate();
  const walkedIn = useRefaey((st) => st.walkedIn);
  const markWalkedIn = useRefaey((st) => st.markWalkedIn);
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const hopRequested = useRef(false);
  const lastHop = useRef(0);
  const quipIndex = useRef(0);
  const paused = useRef(driftPaused);
  paused.current = driftPaused;
  const entered = useRef(onEntered);
  entered.current = onEntered;
  const kind = walkIn ? 'walk' : entrance;
  const floating = pose === 'float';
  const willEnter = kind !== 'none' && !walkedIn && motionOn;

  const draw = useCallback((anim: Anim, frame: number, liftPx = 0, shiftPx = 0, rotDeg = 0) => {
    const el = stage.current;
    const b = box.current;
    if (!el || !b) return;
    const k = b.clientHeight / BOX_H;
    const { frameW, frameH, count, anchorX } = SPEC[anim];
    el.style.width = `${frameW * k}px`;
    el.style.height = `${frameH * k}px`;
    el.style.left = `${(LEFT - anchorX) * k}px`;
    el.style.bottom = `${-FEET_GAP[anim] * k}px`;
    el.style.backgroundImage = `url(${STRIPS[anim]})`;
    el.style.backgroundSize = `${count * frameW * k}px ${frameH * k}px`;
    el.style.backgroundPosition = `${-frame * frameW * k}px 0`;
    el.style.transform = `translate(${shiftPx}px, ${-liftPx}px)${rotDeg ? ` rotate(${rotDeg}deg)` : ''}`;
  }, []);

  const restFrame = floating ? () => draw('hop', floatCycle()[0]) : () => draw('idle', 0);

  // Always show something sensible, including before the loop starts and when motion is off: the first frame of his pose, still.
  useEffect(() => {
    const b = box.current;
    if (!b) return;
    // about to enter: start beyond the left edge, so there is no flash of him standing in place first
    const start = () => (willEnter ? draw(floating ? 'hop' : 'walk', floating ? floatCycle()[0] : 0, 0, -(b.getBoundingClientRect().right + 12)) : restFrame());
    start();
    if (!willEnter) entered.current?.(); // (the parent's handler is idempotent)
    const ro = new ResizeObserver(start);
    ro.observe(b);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, willEnter, motionOn, floating]);

  useEffect(() => {
    if (!motionOn || !visible) return; // frozen on whatever frame is showing
    const b = box.current;
    if (!b) return;
    let raf = 0;
    let mode: 'enter' | 'idle' | 'hop' | 'push' = willEnter ? 'enter' : 'idle';
    let t0 = performance.now();
    let driftT = 0; // drift time only counts while not paused
    let last = t0;
    const cycle = idleCycle(SPEC.idle.count);
    const fCycle = floatCycle();
    const hop = hopTimeline(SPEC.hop.count);
    const distance = () => b.getBoundingClientRect().right + 12;
    let dist = distance();
    let lastKey = '';
    const enterDone = (now: number) => {
      if (!walkedIn) markWalkedIn();
      entered.current?.();
      mode = 'idle';
      t0 = now;
      lastKey = '';
    };
    const floatFrame = () => fCycle[Math.floor(driftT / FLOAT_FRAME_MS) % fCycle.length];
    const tick = (now: number) => {
      const t = now - t0;
      if (!paused.current) driftT += now - last;
      last = now;
      let key = '';
      if (mode === 'enter') {
        if (floating) {
          const p = driftInProgress(t);
          const d = floatDrift(driftT);
          key = `e${Math.round(p * 300)}:${floatFrame()}:${Math.round(d.y * 4)}`;
          if (key !== lastKey) draw('hop', floatFrame(), -d.y, -dist * (1 - p), d.rot);
          if (t >= DRIFT_IN_MS) enterDone(now);
        } else {
          const dur = WALK_IN_MAX_S * 1000;
          const p = Math.min(1, t / dur);
          const frame = Math.floor(t / WALK_FRAME_MS) % SPEC.walk.count;
          key = `w${frame}:${Math.round(p * 200)}`;
          if (key !== lastKey) draw('walk', frame, 0, -dist * (1 - p));
          if (p >= 1) enterDone(now);
        }
      } else if (mode === 'hop') {
        const frame = frameAt(hop.durations, t);
        const lift = hopLiftPx(t, b.clientHeight, SPEC.hop.count);
        key = `h${frame}:${Math.round(lift)}`;
        if (key !== lastKey) draw('hop', frame, lift);
        if (t >= hop.totalMs) {
          mode = 'idle';
          t0 = now;
          key = '';
        }
      } else if (mode === 'push') {
        const off = pushOffset(t);
        const d = floatDrift(driftT);
        key = `p${Math.round(off * 2)}:${Math.round(d.y * 4)}`;
        if (key !== lastKey) draw('hop', floatFrame(), -d.y, off, d.rot);
        if (t >= PUSH_MS) {
          mode = 'idle';
          t0 = now;
          key = '';
        }
      } else if (floating) {
        if (hopRequested.current) {
          hopRequested.current = false;
          mode = 'push';
          t0 = now;
        } else {
          const d = floatDrift(driftT);
          key = `f${floatFrame()}:${Math.round(d.y * 4)}:${Math.round(d.rot * 8)}`;
          if (key !== lastKey) draw('hop', floatFrame(), -d.y, 0, d.rot);
        }
      } else {
        if (hopRequested.current) {
          hopRequested.current = false;
          mode = 'hop';
          t0 = now;
        } else {
          const frame = cycle[Math.floor(t / IDLE_FRAME_MS) % cycle.length];
          key = `i${frame}`;
          if (key !== lastKey) draw('idle', frame);
        }
      }
      lastKey = key;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionOn, visible, willEnter, floating, draw, markWalkedIn]);

  // Hop requests (a lesson learned, a click). Ignored when he may not move.
  useEffect(() => {
    if (!motionOn) return;
    return refaeyActor.onHop(() => {
      hopRequested.current = true;
    });
  }, [motionOn]);

  const onClick = () => {
    if (onActivate) onActivate();
    if (!clickable || !motionOn) return;
    const now = Date.now();
    if (now - lastHop.current < HOP_COOLDOWN_MS) return;
    lastHop.current = now;
    refaeyActor.hop();
    if (!onActivate) {
      refaeyActor.say(QUIPS[quipIndex.current++ % QUIPS.length]);
      window.setTimeout(() => refaeyActor.say(null), QUIP_MS);
    }
  };

  const isButton = !!onActivate;
  return (
    <div className={s.actorWrap}>
      <div
        ref={box}
        className={[s.actor, (clickable || isButton) && s.actorClickable].filter(Boolean).join(' ')}
        style={{ height, aspectRatio: `${BOX_W} / ${BOX_H}` }}
        {...(isButton ? { role: 'button', tabIndex: 0, 'aria-label': activateLabel, onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) } : { 'aria-hidden': true })}
        onClick={onClick}
      >
        <div ref={stage} className={s.actorStage} />
      </div>
    </div>
  );
}
