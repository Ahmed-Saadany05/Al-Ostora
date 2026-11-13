import { REFAEY_COPY } from './copy';
import type { RefaeyMood } from './dialogues/dialogues';
import bustNeutral from './art/refaey-bust-neutral.svg';
import bustSmile from './art/refaey-bust-smile.svg';
import halfPointing from './art/refaey-half-pointing.svg';
import s from './refaey.module.css';

/**
 * Refaey's art, one SVG per mood. The busts are square crops and the half-body is cut flat at the waist, so they are
 * never shown raw: busts go in a circle (RefaeyBust), the half-body is anchored to the bottom edge of the screen
 * (RefaeyStage). To swap the art, replace the files in ./art (or the entries below).
 */
export const ART: Record<RefaeyMood, string> = {
  neutral: bustNeutral,
  smile: bustSmile,
  pointing: halfPointing,
};

/** The circular bust for a mood. The half-body has no bust, so "pointing" uses the smiling one. */
const BUST: Record<RefaeyMood, string> = { neutral: bustNeutral, smile: bustSmile, pointing: bustSmile };

/** Refaey's head and shoulders in a circle (the square crop's corners are never shown). Decorative: the control around it is named. */
export function RefaeyBust({ mood = 'smile', size }: { mood?: RefaeyMood; size: string }) {
  return (
    <span className={s.bust} style={{ width: size, height: size }}>
      <img src={BUST[mood]} alt="" width={256} height={256} draggable={false} />
    </span>
  );
}

/** The half-body pointing pose, anchored to the bottom edge of the screen by its parent. */
export function RefaeyHalf() {
  return <img className={s.half} src={ART.pointing} alt="" draggable={false} />;
}

export const refaeyName = REFAEY_COPY.name;
