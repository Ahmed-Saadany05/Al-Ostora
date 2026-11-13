/**
 * Owner: Aser. "Lander settings": the assumptions behind every number in the mission flow.
 * They live in the app store (useApp().params, saved in the browser) and every planner page
 * passes them into its data hooks, so changing one here re-computes the whole page.
 *
 *  - No mast height: the team decided on a fixed 2 m observer (the engine ignores any other
 *    value), so it is never sent; providers use their 2 m default.
 *  - commsMinClearanceDeg: how far above the ridge Earth must be to count as "in contact".
 *  - No time step: countdowns come from the engine's refined Sun / Earth windows, so the
 *    sampling step no longer sets their accuracy (removed after Goda's review #7).
 */
import { useMemo, useState } from 'react';
import { useApp } from '@/shared/store/app';
import { DEFAULT_PARAMS, type Params } from '@/shared/types';
import { Button, Drawer, Pill } from '@/shared/ui';
import s from './flow.module.css';

/**
 * The settings every planner page passes into useSky / useDayReport / useMetrics / useHorizon.
 * ONLY the Lander settings: passing the whole Params object would also send the stored
 * scoreWeights and override the engine's own defaults (Goda's note), changing the match score.
 * The mast height is NOT sent (fixed 2 m, team decision), so an old saved value can't leak in.
 */
export function usePlannerParams(): Partial<Params> {
  const commsMinClearanceDeg = useApp((st) => st.params.commsMinClearanceDeg);
  return useMemo(() => ({ commsMinClearanceDeg }), [commsMinClearanceDeg]);
}

type Core = Pick<Params, 'commsMinClearanceDeg'>;

const PRESETS: { id: string; label: string; hint: string; v: Core }[] = [
  { id: 'standard', label: 'Standard lander', hint: 'Earth just above the terrain', v: { commsMinClearanceDeg: 0 } },
  { id: 'careful', label: 'Careful radio', hint: 'Earth at least 3° above the terrain', v: { commsMinClearanceDeg: 3 } },
];

const same = (a: Core, b: Core) => a.commsMinClearanceDeg === b.commsMinClearanceDeg;

/** Header button + the drawer it opens. */
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const params = useApp((st) => st.params);
  const setParams = useApp((st) => st.setParams);
  const preset = PRESETS.find((p) => same(p.v, params));

  return (
    <>
      <Button variant="ghost" icon={null} leadingIcon="layers" onClick={() => setOpen(true)} className={s.setBtn}>
        Lander settings
        {!preset || preset.id !== 'standard' ? <span className={s.setBtnTag}>{preset ? preset.label : 'Custom'}</span> : null}
      </Button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Assumptions"
        title="Lander settings"
        next={
          <Button variant="secondary" icon={null} onClick={() => setParams({ observerHeightM: DEFAULT_PARAMS.observerHeightM, commsMinClearanceDeg: DEFAULT_PARAMS.commsMinClearanceDeg, stepMinutes: DEFAULT_PARAMS.stepMinutes })}>
            Reset to standard
          </Button>
        }
      >
        <p className={s.setLead}>
          These are assumptions about your lander. Change one and every number on the page is worked out again. The panels and antenna sit on a fixed
          2 m mast.
        </p>

        <div className={s.setPresets} role="radiogroup" aria-label="Presets">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={preset?.id === p.id} className={s.setPreset} onClick={() => setParams(p.v)}>
              <strong>{p.label}</strong>
              <span>{p.hint}</span>
            </button>
          ))}
          {!preset && <Pill tone="warn" icon="alert" label="Custom settings" />}
        </div>

        <label className={s.setRow}>
          <span className={s.setHead}>
            <span>Radio contact</span>
            <b>{params.commsMinClearanceDeg > 0 ? `Earth at least ${params.commsMinClearanceDeg}° above the terrain` : 'Earth just above the terrain'}</b>
          </span>
          <input type="range" min={0} max={5} step={0.5} value={params.commsMinClearanceDeg} onChange={(e) => setParams({ commsMinClearanceDeg: Number(e.target.value) })} className={s.setRange} />
          <span className={s.setWhy}>Radio needs a clear line to Earth. 0° counts Earth as soon as it clears the terrain; a higher value asks for more margin.</span>
        </label>

      </Drawer>
    </>
  );
}
