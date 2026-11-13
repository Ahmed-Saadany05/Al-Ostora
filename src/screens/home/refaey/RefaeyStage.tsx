import { useEffect } from 'react';
import { RefaeyHalf } from './Refaey';
import { DialogueText } from './DialogueText';
import { useConversation, type ConversationOptions } from './useConversation';
import s from './refaey.module.css';

/**
 * The intro: Refaey's half-body pointing pose rises from the bottom-left (anchored to the bottom edge of the
 * screen, about 58% of its height, the Moon behind him) and his words appear as large text to the right of his hand.
 * Nothing is shown until a conversation is open; Esc or any "OK" closes it and the page comes back.
 */
export function RefaeyStage({ onClose, ...options }: ConversationOptions & { onClose?: () => void }) {
  const { open, content, shouldClose, handle, collapse } = useConversation(options);

  useEffect(() => {
    if (shouldClose) collapse();
  }, [shouldClose, collapse]);

  const close = () => {
    collapse();
    onClose?.();
  };

  if (!open || !content) return null;
  return (
    <div className={s.stage}>
      <div className={s.stageArt} aria-hidden>
        <RefaeyHalf />
      </div>
      <DialogueText className={[s.stageText, s.scrim].join(' ')} content={content} onReply={(r) => handle(r, close)} onCollapse={close} />
    </div>
  );
}
