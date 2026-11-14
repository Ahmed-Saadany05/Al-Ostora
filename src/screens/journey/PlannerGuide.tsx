/**
 * "Plan a future mission": Refaey leads every step. You are helping him plan his own Artemis landing near the south
 * pole: where should he land, and when? One short line per step. It opens when you arrive at a step and folds into
 * his face when closed (click it to hear him again). Launch has its own touchdown card, so he stays quiet there.
 */
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { RefaeyTalk } from './RefaeyTalk';

const LINES: Record<string, { step: string; lines: string[] }> = {
  '/mission': {
    step: 'Step 1 · Where?',
    lines: [
      'My next mission is an Artemis landing near the south pole, and I need your help.',
      'Pick two or three places for me. I need sunlight for power, Earth in the sky for radio, and safe ground.',
    ],
  },
  '/mission/stand': {
    step: 'Step 2 · Stand there',
    lines: ['Stand where I would land. Find the Sun, then Earth: at the pole both stay low, and a ridge can hide them.', 'Play the clock and watch a whole lunar day go by.'],
  },
  '/mission/compare': {
    step: 'Step 3 · Which one?',
    lines: ['Which spot keeps my batteries alive longest?', 'Look at the sunlight, the longest night, and how long Earth stays in view.'],
  },
  '/mission/date': {
    step: 'Step 4 · When?',
    lines: ['Now the timing. Pick a launch date so I touch down with the Sun and Earth both up, and a long day ahead.'],
  },
};

export function PlannerLayout() {
  const { pathname } = useLocation();
  const key = pathname.replace(/\/$/, '');
  const say = LINES[key];
  const [open, setOpen] = useState(true);
  // Open again on every new step.
  useEffect(() => {
    setOpen(true);
    // Compare and Date are busy at the bottom-left: he says his line, then folds into his figure (click him to hear it again).
    if (key !== '/mission/compare' && key !== '/mission/date') return;
    const t = window.setTimeout(() => setOpen(false), 7000);
    return () => window.clearTimeout(t);
  }, [key]);

  return (
    <>
      <Outlet />
      {say && (
        <RefaeyTalk
          key={key}
          placement={key === '/mission' ? 'top-left' : 'bottom-left'}
          style={key === '/mission' ? undefined : { position: 'fixed', bottom: 'calc(var(--statusbar-height) + var(--space-5))' }}
          content={{ key, title: say.step, lines: say.lines, replies: [{ label: 'Got it', next: 'close' }] }}
          onReply={() => setOpen(false)}
          height={key === '/mission/compare' || key === '/mission/date' ? '110px' : '150px'}
          pose="float"
          entrance="none"
          balloonWidth={340}
          hidden={!open}
        />
      )}
    </>
  );
}
