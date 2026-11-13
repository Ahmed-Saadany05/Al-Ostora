/**
 * DEV ONLY (route /refaey, not registered in production builds). A bench for Refaey: replay the briefing, and see the
 * inline "Refaey explains" card with the moments and an explainer. Remove when the feature is done.
 */
import { useMemo, useState } from 'react';
import { Button, DisplayHeading, Eyebrow, Page } from '@/shared/ui';
import { Explain } from '../Explain';
import { RefaeyBriefing } from './RefaeyBriefing';
import { RefaeyMoment, type MomentContext } from './RefaeyMoment';
import { useRefaey } from './store';

const FAKE = { sunElev: '1.7°', sunsetIn: '3d 04h', earthStatus: 'below the horizon', siteName: 'Shackleton Crater Rim', landingDate: '14 Nov 2026' };
const MOMENTS = ['plan-intro', 'step-site', 'step-stand', 'step-dates'];

export function RefaeySandbox() {
  const [horizons, setHorizons] = useState(false);
  const [lola, setLola] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const [round, setRound] = useState(0);
  const begun = useRefaey((st) => st.begun);
  const seen = useRefaey((st) => st.seen);
  const context: MomentContext = useMemo(() => ({ horizons, values: horizons ? FAKE : {}, flags: { horizonLola: lola } }), [horizons, lola]);
  const reset = () => {
    useRefaey.setState({ seen: {}, begun: true });
    setRound((r) => r + 1);
  };
  return (
    <Page>
      <Eyebrow>Refaey sandbox (dev only)</Eyebrow>
      <DisplayHeading size="lg" align="left">
        Refaey
      </DisplayHeading>
      <p style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center' }}>
        <label>
          <input type="checkbox" checked={horizons} onChange={(e) => setHorizons(e.target.checked)} /> Horizons (tokens fill)
        </label>
        <label>
          <input type="checkbox" checked={lola} onChange={(e) => setLola(e.target.checked)} /> LOLA horizon
        </label>
        <label>
          <input type="checkbox" checked={begun} onChange={(e) => useRefaey.setState({ begun: e.target.checked })} /> Begin used once
        </label>
        <Button variant="secondary" size="md" icon={null} onClick={() => setBriefing(true)}>
          Play the briefing
        </Button>
        <Button variant="ghost" onClick={reset}>
          Show the moments again
        </Button>
        <Explain id="low-sun" />
      </p>
      <p>Seen this session: {Object.keys(seen).join(', ') || 'none'}</p>
      <div key={round} style={{ display: 'grid', gap: 'var(--space-4)', maxWidth: 520 }}>
        {MOMENTS.map((id) => (
          <RefaeyMoment key={id} id={id} context={context} />
        ))}
      </div>
      {briefing && <RefaeyBriefing onDone={() => setBriefing(false)} />}
    </Page>
  );
}
