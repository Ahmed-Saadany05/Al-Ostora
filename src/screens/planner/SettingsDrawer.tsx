/**
 * Owner: Aser. "Lander settings": the assumptions behind every number in the mission flow.
 * They live in the app store (useApp().params, saved in the browser) and every planner page
 * passes them into its data hooks, so changing one here re-computes the whole page.
 *
 *  - observerHeightM: how high the panels / antenna sit. Higher → sees over nearby terrain →
 *    lower skyline → more Sun and more Earth.
 *  - commsMinClearanceDeg: how far above the ridge Earth must be to count as "in contact".
 *  - stepMinutes: how often the sky is sampled. Smaller → more exact countdowns, more work.
 */
import { useState } from 'react';
import { useApp } from '@/shared/store/app';
import { DEFAULT_PARAMS, type Params } from '@/shared/types';
import { Button, Drawer, Pill } from '@/shared/ui';
import s from './flow.module.css';

/** The settings every planner page passes into useSky / useDayReport / useMetrics / useHorizon. */
export const usePlannerParams = () => useApp((st) => st.params);

type Core = Pick<Params, 'observerHeightM' | 'commsMinClearanceDeg' | 'stepMinutes'>;

const PRESETS: { id: string; label: string; hint: string; v: Core }[] = [
  { id: 'standard', label: 'Standard lander', hint: '2 m mast · Earth just above the ridge', v: { observerHeightM: 2, commsMinClearanceDeg: 0, stepMinutes: 60 } },
  { id: 'mast', label: 'Tall mast', hint: '10 m mast · 1° radio margin', v: { observerHeightM: 10, commsMinClearanceDeg: 1, stepMinutes: 60 } },
  { id: 'careful', label: 'Careful radio', hint: '2 m mast · 3° radio margin', v: { observerHeightM: 2, commsMinClearanceDeg: 3, stepMinutes: 60 } },
  { id: 'precise', label: 'Precise timing', hint: 'Checks the sky every 15 minutes', v: { observerHeightM: 2, commsMinClearanceDeg: 0, stepMinutes: 15 } },
];
const STEPS = [15, 30, 60, 120];

const same = (a: Core, b: Core) => a.observerHeightM === b.observerHeightM && a.commsMinClearanceDeg === b.commsMinClearanceDeg && a.stepMinutes === b.stepMinutes;

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
        <p className={s.setLead}>These are assumptions about your lander. Change one and every number on the page is worked out again.</p>

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
            <span>Mast height</span>
            <b className="num">{params.observerHeightM} m</b>
          </span>
          <input type="range" min={0.5} max={20} step={0.5} value={params.observerHeightM} onChange={(e) => setParams({ observerHeightM: Number(e.target.value) })} className={s.setRange} />
          <span className={s.setWhy}>How high the solar panels and antenna sit. Higher sees over nearby rocks and ridges, so the skyline looks lower: more Sun and more Earth.</span>
        </label>

        <label className={s.setRow}>
          <span className={s.setHead}>
            <span>Earth must clear the ridge by</span>
            <b className="num">{params.commsMinClearanceDeg}°</b>
          </span>
          <input type="range" min={0} max={5} step={0.5} value={params.commsMinClearanceDeg} onChange={(e) => setParams({ commsMinClearanceDeg: Number(e.target.value) })} className={s.setRange} />
          <span className={s.setWhy}>Radio needs a clear line to Earth. 0° counts Earth as soon as it touches the ridge; a margin of 1–3° is safer.</span>
        </label>

        <div className={s.setRow}>
          <span className={s.setHead}>
            <span>Check the sky every</span>
            <b className="num">{params.stepMinutes} min</b>
          </span>
          <div className={s.setSteps} role="radiogroup" aria-label="Time step">
            {STEPS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={params.stepMinutes === m} className={s.setStep} onClick={() => setParams({ stepMinutes: m })}>
                {m < 60 ? `${m} min` : `${m / 60} h`}
              </button>
            ))}
          </div>
          <span className={s.setWhy}>Smaller steps give more exact countdowns (to about one step), but take longer to work out.</span>
        </div>
      </Drawer>
    </>
  );
}
