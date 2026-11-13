import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import s from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** Makes the whole card a link (shows hover + pointer). */
  to?: string;
  /** Makes the whole card a button. */
  onSelect?: () => void;
  selected?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

export function Card({ children, to, onSelect, selected, padding = 'md', className, ...rest }: CardProps) {
  const interactive = Boolean(to || onSelect);
  const cls = [s.card, s[padding], interactive && s.interactive, selected && s.selected, className]
    .filter(Boolean)
    .join(' ');
  if (to) {
    return (
      <Link to={to} className={cls} aria-current={selected || undefined}>
        {children}
      </Link>
    );
  }
  if (onSelect) {
    return (
      <button type="button" className={cls} onClick={onSelect} aria-pressed={selected}>
        {children}
      </button>
    );
  }
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
