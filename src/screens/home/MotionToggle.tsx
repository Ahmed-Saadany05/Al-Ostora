import { useApp } from '@/shared/store/app';
import { IconButton } from '@/shared/ui';
import { MOTION_COPY } from './content';
import s from './MotionToggle.module.css';

/** Home hides the shared status bar, so the motion switch lives here, wired to the same app state. */
export function MotionToggle() {
  const motion = useApp((st) => st.motion);
  const setMotion = useApp((st) => st.setMotion);
  return (
    <div className={s.corner}>
      <IconButton icon="motion" label={motion ? MOTION_COPY.turnOff : MOTION_COPY.turnOn} onClick={() => setMotion(!motion)} />
    </div>
  );
}
