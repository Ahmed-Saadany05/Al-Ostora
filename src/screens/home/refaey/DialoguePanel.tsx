import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/shared/ui';
import { REFAEY_COPY } from './copy';
import type { Reply } from './dialogues/dialogues';
import { packBeats, type ResolvedNode } from './logic';
import s from './refaey.module.css';

/** Content of one bubble: a resolved dialogue node, or the Ask menu (no lines, only questions). */
export type PanelContent = Pick<ResolvedNode, 'title' | 'lines' | 'replies'> & { key: string };

/** A bubble longer than this many visual lines is split into beats with a Next button. Text is never truncated. */
const MAX_VISUAL_LINES = 4;

/**
 * The speech bubble and up to three reply buttons. Keyboard: Tab and Shift+Tab move between replies, arrow keys do
 * too, Enter chooses, Esc collapses. The bubble is announced politely when it changes.
 * Beats: each line of a node is one sentence; whole lines are grouped so a beat is at most four visual lines.
 */
export function DialoguePanel({
  content,
  onReply,
  onCollapse,
}: {
  content: PanelContent;
  onReply: (reply: Reply) => void;
  onCollapse: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [beats, setBeats] = useState<number[][]>([content.lines.map((_, i) => i)]);
  const [beat, setBeat] = useState(0);

  // Measure how many visual lines each sentence takes at the bubble's real width, then group them into beats.
  useLayoutEffect(() => {
    setBeat(0);
    const compute = () => {
      const m = measure.current;
      if (!m || content.lines.length === 0) return setBeats([content.lines.map((_, i) => i)]);
      const counts = [...m.children].map((p) => {
        const el = p as HTMLElement;
        const lh = parseFloat(getComputedStyle(el).lineHeight);
        return Math.max(1, Math.round(el.offsetHeight / lh));
      });
      setBeats(packBeats(counts, MAX_VISUAL_LINES));
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (bubble.current) ro.observe(bubble.current);
    return () => ro.disconnect();
  }, [content.key, content.lines]);

  const lastBeat = beat >= beats.length - 1;
  const shown = (beats[Math.min(beat, beats.length - 1)] ?? []).map((i) => content.lines[i]);

  // Put focus on the first reply when the bubble changes (or its beats are known: the buttons are replaced then),
  // so the keyboard can answer straight away.
  useEffect(() => {
    root.current?.querySelector<HTMLElement>('[data-reply]')?.focus();
  }, [content.key, beat, beats.length]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCollapse();
      return;
    }
    const arrows = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    if (!arrows.includes(e.key)) return;
    const items = [...(root.current?.querySelectorAll<HTMLElement>('[data-reply]') ?? [])];
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    items[(at + step + items.length) % items.length].focus();
  };

  return (
    <section ref={root} className={s.panel} role="dialog" aria-label={REFAEY_COPY.name} onKeyDown={onKeyDown}>
      <div ref={bubble} className={s.bubble} aria-live="polite">
        {content.title && <p className={s.title}>{content.title}</p>}
        {shown.map((line) => (
          <p key={line} className={s.line}>
            {line}
          </p>
        ))}
        {/* Same width and type as the real lines, invisible: used only to count visual lines. */}
        <div ref={measure} className={s.measure} aria-hidden>
          {content.lines.map((line, i) => (
            <p key={i} className={s.line}>
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className={s.replies}>
        {lastBeat ? (
          content.replies.map((r) => (
            <Button key={r.label} variant="secondary" size="md" icon={null} className={s.reply} data-reply onClick={() => onReply(r)}>
              {r.label}
            </Button>
          ))
        ) : (
          <Button variant="secondary" size="md" icon="arrowRight" className={s.reply} data-reply onClick={() => setBeat((b) => b + 1)}>
            {REFAEY_COPY.next}
          </Button>
        )}
      </div>
    </section>
  );
}
