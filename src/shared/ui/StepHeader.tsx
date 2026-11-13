import type { ReactNode } from 'react';
import { STEPS, type StepId } from '../mission';
import { Button } from './Button';
import { DisplayHeading, Eyebrow } from './Typography';
import s from './StepHeader.module.css';

/**
 * Top of every mission step:
 *   ← Back            STEP 02 / 05 — STAND ON SITE
 *   Big title with an italic accent                         [aside]
 */
export function StepHeader({
  step,
  title,
  accent,
  back,
  meta,
  aside,
}: {
  step: StepId;
  title: ReactNode;
  accent?: ReactNode;
  /** Where "Back" goes, with its label. */
  back?: { to: string; label: string };
  /** Small line under the eyebrow, e.g. coordinates. */
  meta?: ReactNode;
  /** Right side: toggles, best-match pill… */
  aside?: ReactNode;
}) {
  const st = STEPS.find((x) => x.id === step)!;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <header className={s.header}>
      <div className={s.left}>
        {back && (
          <Button variant="secondary" leadingIcon="arrowLeft" icon={null} to={back.to} className={s.back}>
            {back.label}
          </Button>
        )}
        <Eyebrow>
          <span className="num">
            Step {pad(st.n)} / {pad(STEPS.length)}
          </span>{' '}
          — {st.label}
          {meta && <span className={s.meta}> · {meta}</span>}
        </Eyebrow>
        <DisplayHeading as="h1" size="xl" align="left" accent={accent}>
          {title}
        </DisplayHeading>
      </div>
      {aside && <div className={s.aside}>{aside}</div>}
    </header>
  );
}
