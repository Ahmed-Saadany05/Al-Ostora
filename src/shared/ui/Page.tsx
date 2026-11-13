import type { ReactNode } from 'react';
import s from './Page.module.css';

/** Standard page frame: gutters + max width. Use it so all screens line up. */
export function Page({ children, width = 'wide' }: { children: ReactNode; width?: 'wide' | 'narrow' | 'full' }) {
  return <div className={[s.page, s[width]].join(' ')}>{children}</div>;
}

/** Placeholder note for screens that aren't built yet. Delete when you build yours. */
export function OwnerNote({ owner, children }: { owner: string; children: ReactNode }) {
  return (
    <aside className={s.note}>
      <strong>Placeholder · owner: {owner}.</strong> {children}
    </aside>
  );
}
