import type { CardPlacement } from './RefaeyCard';
import { MomentCard } from './MomentCard';
import { StandMoment } from './StandMoment';

/**
 * `<RefaeyMoment id="moment-compare" placement="row" />`: one inline card where Refaey says something on a mission screen.
 * Shown after the briefing, once per session, dismissible. Its replies open an explainer inside the same card, or close it.
 * Live numbers fill only from the screen's own Horizons values (StandMoment reads them); otherwise those lines are skipped.
 */
export function RefaeyMoment({ id, placement = 'card' }: { id: string; placement?: CardPlacement }) {
  return id === 'moment-stand' ? <StandMoment placement={placement} /> : <MomentCard id={id} placement={placement} />;
}
