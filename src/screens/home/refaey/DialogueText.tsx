import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '@/shared/ui';
import { REFAEY_COPY } from './copy';
import type { Reply } from './dialogues/dialogues';
import { packBeats, type ResolvedNode } from './logic';
import { SourceLink } from './SourceLink';
import s from './refaey.module.css';

/** Content of one beat of talk: a resolved dialogue node, or the Ask menu (no lines, only questions). */
export type PanelContent = Pick<ResolvedNode, 'title' | 'lines' | 'replies' | 'link'> & { key: string };

/** A node longer than this many visual lines is split into beats with a Next choice. Text is never truncated. (Six: the briefing's first beat has to carry both Go on and Skip.) */
const MAX_VISUAL_LINES = 6;

/**
 * Refaey's words as large text directly on the scene (no bubble, no box): a small "Refaey" label, the line, then a
 * vertical list of choices with an arrow. Keyboard: Tab and arrows move between choices, Enter chooses, Esc closes.
 * Beats: each line of a node is one sentence; whole lines are grouped so a beat is at most four visual lines.
 */
export function DialogueText({
  content,
  onReply,
  onCollapse,
  className,
  skip,
  bubble = false,
  footer,
}: {
  content: PanelContent;
  onReply: (reply: Reply) => void;
  onCollapse: () => void;
  className?: string;
  /** An extra way out that is not one of the (at most three) replies: the briefing's "Skip". */
  skip?: { label: string; onClick: () => void };
  /** In his speech balloon: no "Refaey" label (the balloon is his), body-size text. */
  bubble?: boolean;
  /** Shown under the lines (the "recorded" label for a line that uses a recorded fact). */
  footer?: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  const lines = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [beats, setBeats] = useState<number[][]>([content.lines.map((_, i) => i)]);
  const [beat, setBeat] = useState(0);

  // Count the visual lines each sentence takes at the real width and font, then group them into beats.
  useLayoutEffect(() => {
    setBeat(0);
    const compute = () => {
      const m = measure.current;
      if (!m || content.lines.length === 0) return setBeats([content.lines.map((_, i) => i)]);
      const counts = [...m.children].map((p) => {
        const el = p as HTMLElement;
        return Math.max(1, Math.round(el.offsetHeight / parseFloat(getComputedStyle(el).lineHeight)));
      });
      setBeats(packBeats(counts, MAX_VISUAL_LINES));
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (lines.current) ro.observe(lines.current);
    return () => ro.disconnect();
  }, [content.key, content.lines]);

  const lastBeat = beat >= beats.length - 1;
  const shown = (beats[Math.min(beat, beats.length - 1)] ?? []).map((i) => content.lines[i]);

  // Focus the first choice when the text changes (or its beats are known: the choices are replaced then).
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
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    const items = [...(root.current?.querySelectorAll<HTMLElement>('[data-reply]') ?? [])];
    if (items.length === 0) return;
    e.preventDefault();
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    items[(items.indexOf(document.activeElement as HTMLElement) + step + items.length) % items.length].focus();
  };

  const choice = (label: string, onClick: () => void) => (
    <Button key={label} variant="ghost" size="md" icon="arrowRight" className={s.reply} data-reply onClick={onClick}>
      {label}
    </Button>
  );

  return (
    <section ref={root} className={[s.talk, className].filter(Boolean).join(' ')} role="dialog" aria-label={REFAEY_COPY.name} onKeyDown={onKeyDown}>
      {!bubble && <p className={s.speaker}>{REFAEY_COPY.speaker}</p>}
      {content.title && <p className={s.topic}>{content.title}</p>}
      <div ref={lines} className={s.lines} aria-live="polite">
        {/* Only this part is re-created (and fades in) when the beat or the node changes. */}
        <div key={`${content.key}:${beat}`} className={s.fade}>
          {shown.map((line) => (
            <p key={line} className={s.line}>
              {line}
            </p>
          ))}
        </div>
        {/* Same width and type as the real lines, invisible: used only to count visual lines. */}
        <div ref={measure} className={s.measure} aria-hidden>
          {content.lines.map((line, i) => (
            <p key={i} className={s.line}>
              {line}
            </p>
          ))}
        </div>
      </div>
      {lastBeat && footer}
      <div key={`${content.key}:${beat}:r`} className={[s.replies, s.fade].join(' ')}>
        {lastBeat && content.link && <SourceLink link={content.link} />}
        {lastBeat ? content.replies.map((r) => choice(r.label, () => onReply(r))) : choice(REFAEY_COPY.next, () => setBeat((b) => b + 1))}
        {skip && (
          <Button variant="ghost" size="md" icon={null} className={[s.reply, s.skip].join(' ')} onClick={skip.onClick}>
            {skip.label}
          </Button>
        )}
      </div>
    </section>
  );
}
