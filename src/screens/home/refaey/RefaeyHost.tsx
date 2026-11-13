import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { missionUrl } from '@/shared/mission';
import type { DialogueAction } from './dialogues/dialogues';
import type { AskScreen } from './registry';
import { RefaeyDock } from './RefaeyDock';
import { RefaeyStage } from './RefaeyStage';
import { useRefaey } from './store';

/** No data tokens or conditions yet on these screens; moments (Part 4) bring their own. */
const CONTEXT = { horizons: false, values: {}, flags: {} } as const;

/** The route's Ask menu, or null where Refaey does not appear (Home keeps its hero clean; About is not his). */
function screenOf(pathname: string): AskScreen | null {
  if (pathname.startsWith('/missions')) return 'missions';
  if (pathname.startsWith('/mission')) return 'mission';
  return null;
}

/**
 * Mounted once in the app shell. After Begin, Pink's flight ends by opening Step 1 (/mission): that is the signal this
 * waits for. Then his half-body rises and the intro starts. Once closed he stays as the small bust bottom-right.
 */
export function RefaeyHost() {
  const { pathname } = useLocation();
  const screen = screenOf(pathname);
  const open = useRefaey((st) => st.open);
  const presence = useRefaey((st) => st.presence);
  const introPending = useRefaey((st) => st.introPending);
  const startIntro = useRefaey((st) => st.startIntro);
  const collapse = useRefaey((st) => st.collapse);

  const onStep1 = pathname === missionUrl.chooseSite();
  useEffect(() => {
    if (introPending && onStep1) startIntro('intro-hello');
  }, [introPending, onStep1, startIntro]);

  // "Plan a future mission" when the flight has already brought you to Step 1: just continue, never replay it.
  const onAction = useCallback(
    (a: DialogueAction) => {
      if (a.type === 'navigate' && a.to === missionUrl.chooseSite() && onStep1) {
        collapse();
        return true;
      }
      return false;
    },
    [collapse, onStep1],
  );

  const focusCorner = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector<HTMLElement>('aside[aria-label="Refaey"] button')?.focus()));
  }, []);

  if (!screen) return null;
  // On document.body, so Pink's hand-off snapshot of the Moon (a fixed image on body) can never cover him while it fades.
  return createPortal(
    open && presence === 'stage' ? (
      <RefaeyStage screen={screen} context={CONTEXT} onAction={onAction} onClose={focusCorner} />
    ) : (
      <RefaeyDock screen={screen} context={CONTEXT} onAction={onAction} />
    ),
    document.body,
  );
}
