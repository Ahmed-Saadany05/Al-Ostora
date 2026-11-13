import { useEffect, useRef } from 'react';
import { RefaeyBust } from './Refaey';
import { DialogueText } from './DialogueText';
import { REFAEY_COPY } from './copy';
import { useConversation, type ConversationOptions } from './useConversation';
import { useRefaey } from './store';
import s from './refaey.module.css';

/**
 * Refaey on every screen except Home, and only once Begin has been used: a small circular bust (56 px, bottom-right).
 * Click it for "Ask Refaey" (2–3 scripted questions for the screen), or let a moment open. Open, he is a 120 px bust at
 * the bottom-left with his words as text to its right; Esc puts him back in the corner.
 */
export function RefaeyDock({ aboveStatusBar = true, ...options }: ConversationOptions & { aboveStatusBar?: boolean }) {
  const begun = useRefaey((st) => st.begun);
  const openAsk = useRefaey((st) => st.openAsk);
  const { open, content, mood, shouldClose, handle, collapse } = useConversation(options);
  const corner = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (shouldClose) collapse();
  }, [shouldClose, collapse]);

  const close = () => {
    collapse();
    requestAnimationFrame(() => corner.current?.focus());
  };

  if (!begun) return null;
  const place = aboveStatusBar ? s.aboveBar : '';
  return (
    <aside aria-label={REFAEY_COPY.name}>
      {open && content ? (
        <div className={[s.dockOpen, s.scrim, place].join(' ')}>
          <RefaeyBust mood={mood} size="var(--bust-lg)" />
          <DialogueText content={content} onReply={(r) => handle(r, close)} onCollapse={close} />
        </div>
      ) : (
        <button ref={corner} type="button" className={[s.corner, place].join(' ')} aria-label={REFAEY_COPY.askOpen} onClick={openAsk}>
          <RefaeyBust mood="smile" size="var(--bust-sm)" />
        </button>
      )}
    </aside>
  );
}
