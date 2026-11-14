/**
 * Compare side by side (Step 2): at most two Moon views next to each other, one shared clock, each
 * with its own drag-to-look-around. The second site can be swapped with the picker.
 */
import type { ReactNode } from 'react';
import { SitePanorama } from '@/scenes';
import { useHorizon, useSky } from '@/shared/data';
import { formatDeg } from '@/shared/format';
import { useTime } from '@/shared/store/time';
import type { Site } from '@/shared/types';
import { Icon, IconButton, Pill, SourceBadge } from '@/shared/ui';
import st from './stand.module.css';

function Pane({ site, mode, children }: { site: Site; mode: 'stand' | 'above'; children?: ReactNode }) {
  const time = useTime((s) => s.time);
  const { data: sky } = useSky(site, time);
  const { data: horizon } = useHorizon(site);
  return (
    <div className={st.pane}>
      <SitePanorama site={site} time={time} sky={sky} horizon={horizon} mode={mode} dense />
      <div className={st.paneHead}>
        <strong>{site.name}</strong>
        {children}
      </div>
      {sky && (
        <div className={st.paneFoot}>
          <Pill tone={sky.sunVisible ? 'sun' : 'neutral'} icon="sun" label={`Sun ${formatDeg(sky.sun.elDeg, 1)}`} />
          <Pill tone={sky.earthVisible ? 'earth' : 'neutral'} icon="antenna" label={`Earth ${formatDeg(sky.earth.elDeg, 1)}`} />
          <SourceBadge source={sky.source} />
        </div>
      )}
    </div>
  );
}

export function SideBySide({
  left,
  right,
  choices,
  mode,
  onPick,
  onClose,
}: {
  left: Site;
  right: Site;
  /** Sites the second view can switch to. */
  choices: Site[];
  mode: 'stand' | 'above';
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className={st.split}>
      <Pane site={left} mode={mode} />
      <Pane site={right} mode={mode}>
        <label className={st.picker}>
          <select value={right.id} onChange={(e) => onPick(e.target.value)} aria-label="Compare with">
            {choices
              .filter((s) => s.id !== left.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <Icon name="compare" size={14} />
        </label>
        <IconButton icon="close" label="Close side by side" onClick={onClose} />
      </Pane>
    </div>
  );
}
