import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DataSource } from '../types';
import { IconButton } from './Button';
import { SourceBadge } from './Pill';
import { Eyebrow } from './Typography';
import s from './Panel.module.css';

interface PanelProps {
  eyebrow?: string;
  title: ReactNode;
  /** Shows a source badge in the header (e.g. 'demo', 'horizons'). */
  source?: DataSource;
  /** Small controls in the header (tabs, icon buttons). */
  actions?: ReactNode;
  children: ReactNode;
  /**
   * REQUIRED: what the user can do next (usually one Button).
   * Every panel ends with a next step — pass `null` only if it truly has none.
   */
  next: ReactNode;
  className?: string;
}

export function Panel({ eyebrow, title, source, actions, children, next, className }: PanelProps) {
  return (
    <section className={[s.panel, className].filter(Boolean).join(' ')}>
      <header className={s.header}>
        <div className={s.titles}>
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h2 className={s.title}>{title}</h2>
        </div>
        <div className={s.actions}>
          {source && <SourceBadge source={source} />}
          {actions}
        </div>
      </header>
      <div className={s.body}>{children}</div>
      {next && <footer className={s.next}>{next}</footer>}
    </section>
  );
}

interface DrawerProps extends Omit<PanelProps, 'className'> {
  open: boolean;
  onClose: () => void;
  side?: 'right' | 'left';
}

/** Side sheet over the scene. Esc and the backdrop close it. */
export function Drawer({ open, onClose, side = 'right', ...panel }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <div className={[s.drawerRoot, open && s.open].filter(Boolean).join(' ')} aria-hidden={!open}>
      <div className={s.backdrop} onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={[s.drawer, s[side]].join(' ')}
        inert={!open}
      >
        <IconButton icon="close" label="Close" onClick={onClose} className={s.close} />
        <Panel {...panel} className={s.drawerPanel} />
      </div>
    </div>,
    document.body,
  );
}
