import { REFAEY_COPY } from './copy';
import type { RefaeyMood } from './dialogues/dialogues';
import bust80 from './art/bust-80.webp';
import bust160 from './art/bust-160.webp';
import s from './refaey.module.css';

/**
 * Refaey's head and shoulders in a circle: the same 3D render as the full-body sprite (cropped from its first idle frame),
 * for every mood. 80 px for the small cards (2× of 40), 160 px for anything larger. Decorative: the control around it is named.
 * `size` is any CSS length; the bust is square and round, so the crop's corners are never shown.
 */
export function RefaeyBust({ size }: { mood?: RefaeyMood; size: string }) {
  const small = /^(\d+(?:\.\d+)?)px$/.exec(size)?.[1];
  const useSmall = small ? Number(small) <= 56 : size.includes('bust-card') || size.includes('bust-inline');
  return (
    <span className={s.bust} style={{ width: size, height: size }}>
      <img src={useSmall ? bust80 : bust160} alt="" width={useSmall ? 80 : 160} height={useSmall ? 80 : 160} draggable={false} />
    </span>
  );
}

export const refaeyName = REFAEY_COPY.name;
