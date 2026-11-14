import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/shared/store/app';
import sprites from './art/sprites.json';
import idleStrip from './art/idle-strip.webp';
import walkStrip from './art/walk-strip.webp';
import hopStrip from './art/hop-strip.webp';
import { refaeyActor } from './actorBus';
import { QUIPS } from './copy';
import { frameAt, hopLiftPx, hopTimeline, idleCycle, IDLE_FRAME_MS, WALK_FRAME_MS, WALK_IN_MAX_S, type Anim } from './spriteMath';
import { useRefaey } from './store';
import s from './refaey.module.css';

const STRIPS: Record<Anim, string> = { idle: idleStrip, walk: walkStrip, hop: hopStrip };
const SPEC = sprites as unknown as Record<Anim, { frameW: number; frameH: number; count: number; anchorX: number }>;
/** One box fits every strip with the feet and the chest on the same spot, so changing animation never shifts him. */
const LEFT = Math.max(...(['idle', 'walk', 'hop'] as Anim[]).map((a) => SPEC[a].anchorX));
const RIGHT = Math.max(...(['idle', 'walk', 'hop'] as Anim[]).map((a) => SPEC[a].frameW - SPEC[a].anchorX));
const BOX_W = LEFT + RIGHT;
const BOX_H = Math.max(...(['idle', 'walk', 'hop'] as Anim[]).map((a) => SPEC[a].frameH));
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
export function RefaeyActor({ height, walkIn = false, clickable = false }: { height: string; walkIn?: boolean; clickable?: boolean }) {
  const { motionOn, visible } = useMayAnimate();
  const walkedIn = useRefaey((st) => st.walkedIn);
  const markWalkedIn = useRefaey((st) => st.markWalkedIn);
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const hopRequested = useRef(false);
  const lastHop = useRef(0);
  const [quip, setQuip] = useState<string | null>(null);
  const quipIndex = useRef(0);
  const willWalkIn = walkIn && !walkedIn && motionOn;

  const draw = useCallback((anim: Anim, frame: number, liftPx = 0, shiftPx = 0) => {
    const el = stage.current;
    const b = box.current;
    if (!el || !b) return;
    const k = b.clientHeight / BOX_H;
    const { frameW, frameH, count, anchorX } = SPEC[anim];
    el.style.width = `${frameW * k}px`;
    el.style.height = `${frameH * k}px`;
    el.style.left = `${(LEFT - anchorX) * k}px`;
    el.style.backgroundImage = `url(${STRIPS[anim]})`;
    el.style.backgroundSize = `${count * frameW * k}px ${frameH * k}px`;
    el.style.backgroundPosition = `${-frame * frameW * k}px 0`;
    el.style.transform = `translate(${shiftPx}px, ${-liftPx}px)`;
  }, []);

  // Always show something sensible, including before the loop starts and when motion is off: idle frame 1, still.
  useEffect(() => {
    const b = box.current;
    if (!b) return;
    // about to walk in: start beyond the left edge, so there is no flash of him standing in place first
    const start = () => (willWalkIn ? draw('walk', 0, 0, -(b.getBoundingClientRect().right + 12)) : draw('idle', 0));
    start();
    const ro = new ResizeObserver(start);
    ro.observe(b);
    return () => ro.disconnect();
  }, [draw, willWalkIn]);

  useEffect(() => {
    if (!motionOn || !visible) return; // frozen on whatever frame is showing (idle frame 1 when motion is off)
    const b = box.current;
    if (!b) return;
    let raf = 0;
    let mode: 'walkin' | 'idle' | 'hop' = willWalkIn ? 'walkin' : 'idle';
    let t0 = performance.now();
    const cycle = idleCycle(SPEC.idle.count);
    const hop = hopTimeline(SPEC.hop.count);
    const walkDistance = () => b.getBoundingClientRect().right + 12; // from beyond the left edge of the screen into his spot
    let distance = walkDistance();
    let lastKey = '';
    const tick = (now: number) => {
      const t = now - t0;
      let key = '';
      if (mode === 'walkin') {
        const dur = WALK_IN_MAX_S * 1000;
        const p = Math.min(1, t / dur);
        const frame = Math.floor(t / WALK_FRAME_MS) % SPEC.walk.count;
        key = `w${frame}:${Math.round(p * 200)}`;
        if (key !== lastKey) draw('walk', frame, 0, -distance * (1 - p));
        if (p >= 1) {
          markWalkedIn();
          mode = 'idle';
          t0 = now;
          key = '';
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
  }, [motionOn, visible, willWalkIn, draw, markWalkedIn]);

  // Hop requests (a lesson learned, a click). Ignored when he may not move.
  useEffect(() => {
    if (!motionOn) return;
    return refaeyActor.onHop(() => {
      hopRequested.current = true;
    });
  }, [motionOn]);

  const onClick = () => {
    if (!clickable || !motionOn) return;
    const now = Date.now();
    if (now - lastHop.current < HOP_COOLDOWN_MS) return;
    lastHop.current = now;
    refaeyActor.hop();
    setQuip(QUIPS[quipIndex.current++ % QUIPS.length]);
    window.setTimeout(() => setQuip(null), QUIP_MS);
  };

  return (
    <div className={s.actorWrap}>
      {quip && (
        <p className={s.quip} role="status">
          {quip}
        </p>
      )}
      <div
        ref={box}
        className={[s.actor, clickable && s.actorClickable].filter(Boolean).join(' ')}
        style={{ height, aspectRatio: `${BOX_W} / ${BOX_H}` }}
        aria-hidden
        onClick={onClick}
      >
        <div ref={stage} className={s.actorStage} />
      </div>
    </div>
  );
}
