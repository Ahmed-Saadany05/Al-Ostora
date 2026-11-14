import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useApp } from '@/shared/store/app';
import { DialogueText, type PanelContent } from './DialogueText';
import { ACTOR_ASPECT, RefaeyActor, useQuip } from './RefaeyActor';
import { REFAEY_COPY } from './copy';
import type { Reply } from './dialogues/dialogues';
import { collectKeepOuts, safeArea } from './keepOuts';
import { BALLOON, chooseSlot, KEEP_CLEAR, type Chosen, type PlaceCtx, type Rect, type Slot } from './placement';
import s from './refaey.module.css';

const POP_MS = 180;

/**
 * Refaey placed IN a screen: his full-body figure in the free space of the page (standing on a surface or floating) and one
 * speech balloon with the current beat and its replies. The slot is chosen at run time from the screen's candidate slots by
 * keeping clear of everything that matters (see placement.ts); `onPlaced(false)` means nothing fit and the page shows its
 * plain layout instead. Re-placed on resize (debounced); never moves while the balloon is open otherwise.
 * The chosen slot is in data-slot (and data-side, data-fig, data-balloon-box) for the tests.
 */
export function RefaeyStage({
  slots,
  scope,
  chrome = true,
  content,
  onReply,
  skip,
  onEscape,
  onPlaced,
  entrance = 'drift',
  minWidth = 900,
  reserveH = BALLOON.h,
  footer,
}: {
  slots: Slot[];
  /** The element whose contents are checked for keep-outs. */
  scope: RefObject<HTMLElement | null>;
  /** The page has an app header and status bar to stay clear of. */
  chrome?: boolean;
  content: PanelContent;
  onReply: (reply: Reply) => void;
  skip?: { label: string; onClick: () => void };
  /** Esc: by default it closes the balloon (he stays; clicking him reopens it at the same beat). */
  onEscape?: () => void;
  onPlaced: (placed: boolean, slot: Slot | null) => void;
  entrance?: 'none' | 'walk' | 'drift';
  minWidth?: number;
  /** Worst-case balloon height for this screen's content (a one-line idle remark needs far less than a story beat with three replies). */
  reserveH?: number;
  footer?: ReactNode;
}) {
  const motion = useApp((st) => st.motion);
  const root = useRef<HTMLDivElement>(null);
  const balloon = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<Chosen | null>(null);
  const [open, setOpen] = useState(true);
  const [entered, setEntered] = useState(false);
  const [popping, setPopping] = useState(false);
  const quip = useQuip();
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const onPlacedRef = useRef(onPlaced);
  onPlacedRef.current = onPlaced;
  const openRef = useRef(open);
  openRef.current = open;

  const place = useCallback(() => {
    const sc = scope.current;
    if (!sc || window.innerWidth < minWidth) {
      if (sc) sc.dataset.stage = 'off';
      setPlaced(null);
      onPlacedRef.current(false, null);
      return;
    }
    // Measure with the page in its stage layout (plain layout hidden): the stage owns the page's data-stage attribute.
    sc.dataset.stage = 'on';
    void sc.offsetHeight;
    const raw = safeArea(chrome);
    const safe = {
      x: KEEP_CLEAR,
      y: raw.y + (chrome ? KEEP_CLEAR : 0),
      w: raw.w - 2 * KEEP_CLEAR,
      h: raw.h - (chrome ? 2 * KEEP_CLEAR : 0) - (chrome ? 0 : 0),
    };
    const ctx: PlaceCtx = {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      safe: chrome
        ? safe
        : {
            x: KEEP_CLEAR,
            y: KEEP_CLEAR,
            w: raw.w - 2 * KEEP_CLEAR,
            h: raw.h - 2 * KEEP_CLEAR,
          },
      anchor: (name) => {
        const el = sc.querySelector(`[data-refaey-anchor="${name}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
      },
    };
    const keepOuts = collectKeepOuts(sc, root.current);
    const chosen = chooseSlot(slotsRef.current, ctx, keepOuts, ACTOR_ASPECT, {
      ...BALLOON,
      h: reserveH,
    });
    if (import.meta.env.DEV)
      (window as unknown as Record<string, unknown>).__refaeyPlace = {
        safe: ctx.safe,
        keepOuts,
        chosen: chosen?.slot.id ?? null,
      };
    sc.dataset.stage = chosen ? 'on' : 'off';
    setPlaced(chosen);
    onPlacedRef.current(!!chosen, chosen?.slot ?? null);
  }, [scope, chrome, minWidth, reserveH]);

  // First placement once fonts are in (text widths are final); then on every resize (debounced). A re-placement jumps.
  useLayoutEffect(() => {
    let alive = true;
    let timer = 0;
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => alive && place(), 120);
    };
    // the first placement waits for the fonts (text widths are final), so it is not made twice (and never flips)
    if (document.fonts && window.innerWidth >= minWidth) void document.fonts.ready.then(() => alive && requestAnimationFrame(() => alive && place()));
    else place();
    window.addEventListener('resize', later);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.removeEventListener('resize', later);
    };
  }, [place]);

  // Esc closes the balloon from anywhere on the page (the dialog also handles it when focus is inside it); focus then goes to him.
  const escape = useRef(onEscape);
  escape.current = onEscape;
  const wasOpen = useRef(true);
  useEffect(() => {
    if (!placed || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      if (escape.current) escape.current();
      else setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placed, open]);
  useEffect(() => {
    if (wasOpen.current && !open) root.current?.querySelector<HTMLElement>('[role="button"]')?.focus();
    wasOpen.current = open;
  }, [open]);

  // The balloon pops (opacity + scale 0.96 → 1, ≤ 180 ms; none without motion) once his entrance is over; the drift pauses meanwhile.
  const showBalloon = !!placed && open && entered;
  useEffect(() => {
    const el = balloon.current;
    if (!showBalloon || !el || !motion) return;
    setPopping(true);
    const a = el.animate(
      [
        { opacity: 0, transform: 'scale(0.96)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: POP_MS, easing: 'ease-out' },
    );
    const done = () => setPopping(false);
    a.finished.then(done, done);
    return () => a.cancel();
  }, [showBalloon, motion]);

  if (!placed) return null;
  const { figure, balloon: reserve, side, slot, height } = placed;
  const standing = slot.pose === 'stand';
  const grow = side === 'above' ? { bottom: window.innerHeight - (figure.y - 20) } : { top: figure.y };
  const bx = side === 'right' ? reserve.x : side === 'left' ? window.innerWidth - (reserve.x + reserve.w) : reserve.x;
  const pos: React.CSSProperties = {
    ...(side === 'left' ? { right: bx } : { left: bx }),
    ...grow,
    width: reserve.w,
    '--tail-y': `${Math.round(height * 0.1)}px`,
  } as unknown as React.CSSProperties;
  const rect = (r: Rect) => [r.x, r.y, r.w, r.h].map(Math.round).join(',');

  return (
    <div
      ref={root}
      className={s.stageLayer}
      data-refaey-stage
      data-slot={slot.id}
      data-pose={slot.pose}
      data-side={side}
      data-open={open}
      data-fig={rect(figure)}
      data-balloon-box={rect(reserve)}
    >
      <div
        className={s.stageFigure}
        style={{
          left: figure.x,
          top: figure.y,
          width: figure.w,
          height: figure.h,
        }}
      >
        <RefaeyActor
          height={`${figure.h}px`}
          pose={slot.pose}
          entrance={entrance}
          clickable
          driftPaused={popping}
          onEntered={() => setEntered(true)}
          onActivate={open ? undefined : () => setOpen(true)}
          activateLabel={`${REFAEY_COPY.name}: open`}
        />
        {standing && <span className={s.contactShadow} aria-hidden />}
      </div>
      {showBalloon && (
        <div ref={balloon} className={s.balloon} data-side={side} style={pos}>
          <div className={s.quipHost} data-quip={quip !== null}>
            <DialogueText
              className={s.balloonTalk}
              bubble
              content={content}
              onReply={onReply}
              onCollapse={onEscape ?? (() => setOpen(false))}
              skip={skip}
              footer={footer}
            />
            {quip && (
              <p className={s.quipLine} role="status">
                {quip}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
