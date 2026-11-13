import { Button } from '@/shared/ui';
import { RefaeyBust } from './Refaey';
import { REFAEY_COPY } from './copy';
import type { RefaeyMood } from './dialogues/dialogues';
import s from './refaey.module.css';

export interface CardAction {
  label: string;
  onClick: () => void;
}

/**
 * The only way Refaey speaks on a data screen: a small inline card with a 40 px circular bust and his line.
 * Same look everywhere (moments and explainers). It sits in the page flow; it never covers anything.
 */
export function RefaeyCard({
  title,
  mood = 'smile',
  lines,
  actions = [],
  id,
}: {
  title?: string;
  mood?: RefaeyMood;
  lines: string[];
  actions?: CardAction[];
  id?: string;
}) {
  return (
    <aside id={id} className={s.card} aria-label={REFAEY_COPY.explains}>
      <RefaeyBust mood={mood} size="var(--bust-card)" />
      <div className={s.cardBody}>
        <p className={s.cardLabel}>{REFAEY_COPY.explains}</p>
        {title && <p className={s.cardTitle}>{title}</p>}
        {lines.map((l) => (
          <p key={l} className={s.cardText}>
            {l}
          </p>
        ))}
        {actions.length > 0 && (
          <div className={s.cardActions}>
            {actions.map((a) => (
              <Button key={a.label} variant="ghost" size="md" icon="arrowRight" className={s.cardAction} onClick={a.onClick}>
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
