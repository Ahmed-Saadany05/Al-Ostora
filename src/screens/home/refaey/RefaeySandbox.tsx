/**
 * DEV ONLY (route /refaey, not registered in production builds). A bench for Refaey's states: open any node, switch the
 * Horizons/LOLA conditions on and off, and see long text split into beats. Remove when the feature is done.
 */
import { useMemo, useState } from 'react';
import { Button, DisplayHeading, Eyebrow, Page } from '@/shared/ui';
import { RefaeyDock } from './RefaeyDock';
import { getNode, type RuntimeNode } from './registry';
import { useRefaey } from './store';

const LONG: RuntimeNode = {
  id: 'sandbox-long',
  mood: 'smile',
  lines: [
    'This is a deliberately long sentence that keeps going so that it needs several visual lines inside the bubble, to prove that nothing is ever cut off.',
    'A second sentence, also on the long side, so the pair together cannot fit in four visual lines at this width.',
    'And a short one.',
  ],
  replies: [{ label: 'Got it', action: { type: 'collapse' } }],
};

const FAKE = { sunElev: '1.7°', sunsetIn: '3d 04h', earthStatus: 'below the horizon', siteName: 'Shackleton Crater Rim', landingDate: '14 Nov 2026' };

const IDS = ['intro-hello', 'intro-thumb', 'intro-choice', 'missions-hub', 'athena-3', 'plan-intro', 'step-site', 'step-stand', 'step-dates', 'outcome-play', 'outcome-night', 'explain:lunar-day', 'sandbox-long'];

export function RefaeySandbox() {
  const [horizons, setHorizons] = useState(false);
  const [lola, setLola] = useState(false);
  const { openNode, openAsk, collapse, seen } = useRefaey();
  const context = useMemo(() => ({ horizons, values: horizons ? FAKE : {}, flags: { horizonLola: lola } }), [horizons, lola]);
  const lookup = (id: string, backTo?: string) => (id === LONG.id ? LONG : getNode(id, backTo));
  return (
    <Page>
      <Eyebrow>Refaey sandbox (dev only)</Eyebrow>
      <DisplayHeading size="lg" align="left">
        Refaey
      </DisplayHeading>
      <p>
        Data source:{' '}
        <label>
          <input type="checkbox" checked={horizons} onChange={(e) => setHorizons(e.target.checked)} /> Horizons (tokens fill)
        </label>{' '}
        <label>
          <input type="checkbox" checked={lola} onChange={(e) => setLola(e.target.checked)} /> LOLA horizon
        </label>
      </p>
      <p style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {IDS.map((id) => (
          <Button key={id} variant="secondary" size="md" icon={null} onClick={() => openNode(id)}>
            {id}
          </Button>
        ))}
        <Button variant="ghost" onClick={openAsk}>
          Ask menu
        </Button>
        <Button variant="ghost" onClick={collapse}>
          Collapse
        </Button>
      </p>
      <p>Seen this session: {Object.keys(seen).join(', ') || 'none'}</p>
      <RefaeyDock screen="mission" context={context} lookup={lookup} />
    </Page>
  );
}
