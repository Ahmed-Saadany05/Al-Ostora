/**
 * Owner: Hady. "What's this?" toggle that reveals a short explainer.
 *   import { Explain } from '@/screens/home/Explain';
 *   <Explain id="low-sun" />
 */
import { useId, useState } from 'react';
import { Icon } from '@/shared/ui';
import { EXPLAINERS, type ExplainerId } from './explainers';
import s from './Explain.module.css';

export function Explain({ id }: { id: ExplainerId }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const e = EXPLAINERS[id];
  return (
    <span className={s.wrap}>
      <button type="button" className={s.trigger} aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}>
        <Icon name="info" size={14} />
        {e.title}
      </button>
      {open && (
        <span id={panel} role="note" className={s.panel}>
          {e.body}
        </span>
      )}
    </span>
  );
}
