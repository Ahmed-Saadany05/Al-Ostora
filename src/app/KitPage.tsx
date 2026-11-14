/** Live reference for the shared UI kit (owner: Hagras). Open /kit while building. */
import { useState, type ReactNode } from 'react';
import { useTime } from '@/shared/store/time';
import type { TimeWindow } from '@/shared/types';
import {
  Button,
  Card,
  CountdownChip,
  DateField,
  ProgressRing,
  TimelineLegend,
  TimelineStrip,
  DisplayHeading,
  Divider,
  Drawer,
  EmptyState,
  ErrorState,
  Eyebrow,
  IconButton,
  Lead,
  LoadingState,
  Metric,
  Page,
  Panel,
  Pill,
  Skeleton,
  SourceBadge,
  Tabs,
  TimeBar,
} from '@/shared/ui';
import s from './KitPage.module.css';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.section}>
      <Eyebrow>{title}</Eyebrow>
      <div className={s.row}>{children}</div>
    </section>
  );
}

const h = (n: number) => new Date(Date.UTC(2026, 10, 13) + n * 3_600_000).toISOString();
const win = (a: number, b: number): TimeWindow => ({ start: h(a), end: h(b), durationH: b - a, clipped: false });

export function KitPage() {
  const [tab, setTab] = useState<'day' | 'season'>('day');
  const [seg, setSeg] = useState<'sun' | 'earth' | 'both'>('both');
  const [drawer, setDrawer] = useState(false);
  const [t, setT] = useState(h(200));
  const [playing, setPlaying] = useState(false);
  const now = useTime((st) => st.time);

  return (
    <Page>
      <div>
        <Eyebrow>Shared UI kit</Eyebrow>
        <DisplayHeading size="xl" align="left" accent="parts.">
          The building
        </DisplayHeading>
      </div>
      <Lead align="left">
        Import everything from <code>@/shared/ui</code>. Colours, type and spacing come from <code>tokens.css</code> — never
        hard-code them. Demo values below are illustrative.
      </Lead>

      <Section title="Type">
        <div className={s.stack}>
          <DisplayHeading size="lg" align="left" accent="Moon.">
            A little closer to the
          </DisplayHeading>
          <p>
            Body text in Saira. Numbers always in mono: <span className="num">+1.88°</span>,{' '}
            <span className="num">29.53 d</span>.
          </p>
        </div>
      </Section>

      <Section title="Buttons — one primary per screen">
        <Button variant="primary" size="lg">
          Begin the journey
        </Button>
        <Button variant="primary">Compare sites</Button>
        <Button variant="secondary" icon="arrowRight">
          Next step
        </Button>
        <Button variant="secondary" leadingIcon="plus" icon={null}>
          Add site
        </Button>
        <Button variant="ghost" icon="external" href="https://ssd.jpl.nasa.gov/horizons/">
          JPL Horizons
        </Button>
        <Button variant="secondary" disabled>
          Disabled
        </Button>
        <IconButton icon="play" label="Play" />
        <IconButton icon="pause" label="Pause" active />
      </Section>

      <Section title="Pills — icon + word, never colour alone">
        <Pill tone="sun" icon="sun" label="In sunlight" />
        <Pill tone="earth" icon="antenna" label="Earth in view" />
        <Pill tone="good" icon="check" label="Good for power" />
        <Pill tone="warn" icon="alert" label="Short window" />
        <Pill tone="bad" icon="alert" label="No Earth link" />
        <Pill icon="pin" label="Artemis candidate" />
        <SourceBadge source="demo" />
        <SourceBadge source="horizons" />
        <SourceBadge source="lola" />
        <SourceBadge source="computed" />
      </Section>

      <Section title="Countdowns">
        <CountdownChip kind="sunset" now={now} target={new Date(Date.parse(now) + 76.2 * 3_600_000).toISOString()} />
        <CountdownChip kind="earthset" now={now} target={new Date(Date.parse(now) + 5.2 * 3_600_000).toISOString()} />
        <CountdownChip kind="earthrise" now={now} target={null} />
      </Section>

      <Section title="Metric tiles">
        <div className={s.metrics}>
          <Metric label="Sun elevation" icon="sun" tone="sun" value={1.88} unit="°" digits={2} source="demo" hint="Azimuth 9° (N)" />
          <Metric label="Sunlit" icon="battery" value={82} unit="%" digits={0} hint="Of one lunar day" />
          <Metric label="Longest night" icon="moon" value={null} display="3d 04h" unit="h" hint="Battery must last this" />
          <Metric label="Earth elevation" icon="earth" tone="earth" value={undefined} unit="°" hint="Unknown → shows —" />
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs
          label="Range"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'day', label: 'Lunar day' },
            { id: 'season', label: 'Season' },
          ]}
        />
        <Divider vertical />
        <Tabs
          label="Show"
          variant="pill"
          value={seg}
          onChange={setSeg}
          items={[
            { id: 'sun', label: 'Sun' },
            { id: 'earth', label: 'Earth' },
            { id: 'both', label: 'Both' },
          ]}
        />
      </Section>

      <Section title="Time bar">
        <div className={s.full}>
          <TimeBar
            start={h(0)}
            end={h(709)}
            value={t}
            onChange={setT}
            playing={playing}
            onTogglePlay={() => setPlaying(!playing)}
            sunWindows={[win(0, 180), win(260, 520), win(600, 709)]}
            earthWindows={[win(90, 300), win(420, 640)]}
          />
        </div>
      </Section>

      <Section title="Progress rings · timeline strip · date field">
        <ProgressRing value={0.91} label="Sunlight" tone="sun" />
        <ProgressRing value={0.6} label="Earth link" tone="earth" />
        <ProgressRing value={0.58} label="Both" />
        <ProgressRing value={null} label="Unknown" />
        <div className={s.full}>
          <TimelineLegend />
          <TimelineStrip
            start={h(0)}
            end={h(709)}
            sunWindows={[win(0, 180), win(260, 520), win(600, 709)]}
            earthWindows={[win(90, 300), win(420, 640)]}
            highlight={win(90, 180)}
            now={t}
            onSelectTime={setT}
          />
        </div>
        <div style={{ width: 320 }}>
          <DateField label="Launch date" value={t} onChange={setT} hint="Always UTC." />
        </div>
      </Section>

      <Section title="Cards">
        <div className={s.cards}>
          <Card>
            <Eyebrow>Static card</Eyebrow>
            <p>For grouping content.</p>
          </Card>
          <Card onSelect={() => undefined}>
            <Eyebrow>Clickable card</Eyebrow>
            <p>Lifts on hover.</p>
          </Card>
          <Card selected onSelect={() => undefined}>
            <Eyebrow>Selected</Eyebrow>
            <p>White outline.</p>
          </Card>
        </div>
      </Section>

      <Section title="Panel — always ends with a next step">
        <Panel
          eyebrow="Shackleton rim"
          title="Power outlook"
          source="demo"
          next={
            <>
              <Button variant="ghost">Details</Button>
              <Button variant="primary" onClick={() => setDrawer(true)}>
                Open drawer
              </Button>
            </>
          }
          className={s.full}
        >
          <p style={{ color: 'var(--color-text-muted)' }}>Panel body. Glass surface over the 3D scene.</p>
        </Panel>
      </Section>

      <Section title="States">
        <div className={s.cards}>
          <Card padding="sm">
            <EmptyState compact title="No sites yet" message="Pick one to start." action={<Button variant="secondary">Choose a site</Button>} />
          </Card>
          <Card padding="sm">
            <LoadingState compact title="Asking JPL Horizons…" />
          </Card>
          <Card padding="sm">
            <ErrorState compact title="Horizons didn't answer" message="Using the recorded answer." action={<Button variant="secondary">Retry</Button>} />
          </Card>
        </div>
        <div className={s.stack} style={{ width: 280 }}>
          <Skeleton height={20} width="60%" />
          <Skeleton height={12} />
          <Skeleton height={12} width="80%" />
        </div>
      </Section>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        eyebrow="Site"
        title="Malapert Massif"
        source="demo"
        next={
          <Button variant="primary" onClick={() => setDrawer(false)}>
            Add to compare
          </Button>
        }
      >
        <p style={{ color: 'var(--color-text-muted)' }}>Drawers slide over the scene. Esc or the backdrop closes them.</p>
      </Drawer>
    </Page>
  );
}
