import type { ElementType, ReactNode } from 'react';
import s from './Typography.module.css';

/** SMALL LETTER-SPACED LABEL above titles and in the status bar. */
export function Eyebrow({ children, as: Tag = 'p', className }: { children: ReactNode; as?: ElementType; className?: string }) {
  return <Tag className={[s.eyebrow, className].filter(Boolean).join(' ')}>{children}</Tag>;
}

/**
 * Big sans headline with an optional italic serif accent, e.g.
 *   <DisplayHeading accent="Moon.">A little closer to the</DisplayHeading>
 */
export function DisplayHeading({
  children,
  accent,
  size = 'display',
  as: Tag = 'h1',
  align = 'center',
}: {
  children: ReactNode;
  accent?: ReactNode;
  size?: 'display' | 'xl' | 'lg';
  as?: ElementType;
  align?: 'center' | 'left';
}) {
  return (
    <Tag className={[s.display, s[`size-${size}`], s[align]].join(' ')}>
      {children}
      {accent && (
        <>
          {' '}
          <em className={s.accent}>{accent}</em>
        </>
      )}
    </Tag>
  );
}

export function Lead({ children, align = 'center' }: { children: ReactNode; align?: 'center' | 'left' }) {
  return <p className={[s.lead, s[align]].join(' ')}>{children}</p>;
}

export function Divider({ vertical }: { vertical?: boolean }) {
  return <span role="separator" className={vertical ? s.vdivider : s.divider} />;
}
