import type { CardPlacement } from './RefaeyCard';
import { MomentCard } from './MomentCard';
import { OutcomeMoment } from './OutcomeMoment';
import { StandMoment } from './StandMoment';

/**
 * `<RefaeyMoment id="moment-compare" placement="row" />`: one inline card where Refaey says something on a mission screen.
 * Shown after the briefing, once per session, dismissible. Its replies open an explainer inside the same card, or close it.
 * Live numbers fill only from the screen's own Horizons values (StandMoment reads them); otherwise those lines are skipped.
 */
export function RefaeyMoment({ id, placement = 'card' }: { id: string; placement?: CardPlacement }) {
  if (id === 'moment-stand') return <StandMoment placement={placement} />;
  if (id === 'moment-outcome') return <OutcomeMoment placement={placement} />;
  return <MomentCard id={id} placement={placement} />;
}
