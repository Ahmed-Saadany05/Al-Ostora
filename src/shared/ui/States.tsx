import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import s from './States.module.css';

interface StateProps {
  title: string;
  message?: ReactNode;
  /** The next step — usually one Button. */
  action?: ReactNode;
  compact?: boolean;
}

function Shell({ icon, tone, title, message, action, compact, live }: StateProps & { icon: ReactNode; tone?: string; live?: 'polite' | 'assertive' }) {
  return (
    <div className={[s.state, compact && s.compact, tone && s[tone]].filter(Boolean).join(' ')} role={live ? 'status' : undefined} aria-live={live}>
      <div className={s.icon}>{icon}</div>
      <p className={s.title}>{title}</p>
      {message && <p className={s.message}>{message}</p>}
      {action && <div className={s.action}>{action}</div>}
    </div>
  );
}

export function EmptyState({ icon = 'moon', ...p }: StateProps & { icon?: IconName }) {
  return <Shell icon={<Icon name={icon} size={22} />} {...p} />;
}

export function LoadingState({ title = 'Loading…', ...p }: Partial<StateProps>) {
  return <Shell icon={<span className={s.spinner} />} title={title} live="polite" {...p} />;
}

export function ErrorState({ title = 'Something went wrong', ...p }: Partial<StateProps>) {
  return <Shell icon={<Icon name="alert" size={22} />} tone="error" title={title} live="assertive" {...p} />;
}

/** Shimmering placeholder block for content that is loading. */
export function Skeleton({ width = '100%', height = 16, radius = 8 }: { width?: number | string; height?: number | string; radius?: number }) {
  return <span className={s.skeleton} style={{ width, height, borderRadius: radius }} aria-hidden />;
}
