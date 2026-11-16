import type { ReactNode } from 'react';
import { Button } from '@/shared/ui';
import { RefaeyBust } from './Refaey';
import { SourceLink } from './SourceLink';
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
export type CardPlacement = 'card' | 'stage' | 'stage-high';

export function RefaeyCard({
  title,
  mood = 'smile',
  lines,
  actions = [],
  id,
  placement = 'card',
  badge,
  link,
  pop,
}: {
  title?: string;
  mood?: RefaeyMood;
  lines: string[];
  actions?: CardAction[];
  id?: string;
  /** 'card': in the page flow. 'stage': a compact card (max 360 px) pinned bottom-left of a full-bleed 3D screen, in the zone that is free of the title, markers, drawers and the primary button. 'stage-high': the same, lifted clear of the touchdown screen's wide button row on narrower screens. */
  placement?: CardPlacement;
  /** e.g. the "JPL Horizons · recorded" label, when a line uses a recorded fact. */
  badge?: ReactNode;
  /** A source card's link. */
  link?: { label: string; href: string };
  /** Opening ('in') or closing ('out') animation, for cards that pop up (moments). */
  pop?: 'in' | 'out';
}) {
  return (
    <aside id={id} className={[s.card, (placement === 'stage' || placement === 'stage-high') && s.cardStage, placement === 'stage-high' && s.cardStageHigh, pop === 'in' && s.popIn, pop === 'out' && s.popOut].filter(Boolean).join(' ')} aria-label={REFAEY_COPY.explains}>
      <RefaeyBust mood={mood} size="var(--bust-card)" />
      <div className={s.cardBody}>
        <p className={s.cardLabel}>{REFAEY_COPY.explains}</p>
        {title && <p className={s.cardTitle}>{title}</p>}
        {lines.map((l) => (
          <p key={l} className={s.cardText}>
            {l}
          </p>
        ))}
        {badge}
        {link && <SourceLink link={link} />}
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
