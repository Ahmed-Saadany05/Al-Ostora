/**
 * A sprite-sheet animation (owner: Pink): plays the frames of one image laid out in a grid, left to
 * right, top to bottom, in a loop. Used by every loading screen in place of the loading text (see
 * LOADER_SPRITE). The frame is stepped with background-position on a timer, so React does not
 * re-render per frame. Without motion it holds the first frame.
 */
import { useEffect, useRef } from 'react';
import { useApp } from '@/shared/store/app';
import s from './SpriteAnimation.module.css';

export interface SpriteSheet {
  /** Image path (put the file in /public, e.g. '/sprites/loader.png'). */
  src: string;
  cols: number;
  rows: number;
  /** Frames actually used (the last row may be partly empty). Default cols × rows. */
  frames?: number;
  /** Frames per second. */
  fps: number;
  /** One frame's width ÷ height. Default 1 (square frames). */
  aspect?: number;
}

/**
 * The loading animation used everywhere (first-visit loader, loading states, the 3D Moon's loading
 * pill). null: no sheet yet, the loaders keep their text and spinner. Set it to switch them all over,
 * e.g. { src: '/sprites/loader.png', cols: 8, rows: 4, frames: 30, fps: 18 }.
 */
export const LOADER_SPRITE: SpriteSheet | null = {
  src: '/sprites/rocket-loader.png',
  cols: 6,
  rows: 4,
  frames: 24,
  fps: 18,
};

export function SpriteAnimation({ sheet, size, className }: { sheet: SpriteSheet; /** Frame height (any CSS length). */ size: string; className?: string }) {
  const motion = useApp((st) => st.motion);
  const el = useRef<HTMLSpanElement>(null);
  const { src, cols, rows, fps, aspect = 1 } = sheet;
  const frames = sheet.frames ?? cols * rows;

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const show = (f: number) => {
      const x = cols > 1 ? ((f % cols) / (cols - 1)) * 100 : 0;
      const y = rows > 1 ? (Math.floor(f / cols) / (rows - 1)) * 100 : 0;
      node.style.backgroundPosition = `${x}% ${y}%`;
    };
    show(0);
    if (!motion || frames < 2) return;
    let f = 0;
    const t = window.setInterval(() => show((f = (f + 1) % frames)), 1000 / fps);
    return () => window.clearInterval(t);
  }, [cols, rows, frames, fps, motion]);

  return (
    <span
      ref={el}
      className={[s.sprite, className].filter(Boolean).join(' ')}
      style={{
        height: size,
        aspectRatio: String(aspect),
        backgroundImage: `url(${src})`,
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
      }}
      aria-hidden
    />
  );
}
