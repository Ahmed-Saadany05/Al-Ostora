import { useRef, type KeyboardEvent } from 'react';
import s from './Tabs.module.css';

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

/**
 * Text tabs with the dot indicator from the top nav.
 * `variant="pill"` = segmented control for compact toolbars.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  variant = 'text',
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name for the tab list. */
  label: string;
  variant?: 'text' | 'pill';
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    const next = (i + dir + items.length) % items.length;
    onChange(items[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={[s.tabs, s[variant]].join(' ')}>
      {items.map((it, i) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={[s.tab, active && s.active].filter(Boolean).join(' ')}
            onClick={() => onChange(it.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
