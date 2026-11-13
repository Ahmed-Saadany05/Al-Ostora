/** PLACEHOLDER — owner: Goda. Fill in citations + AI-use disclosure. */
import { Button, Card, DisplayHeading, Eyebrow, Lead, OwnerNote, Page } from '@/shared/ui';

const SOURCES = [
  { name: 'JPL Horizons', by: 'NASA JPL', url: 'https://ssd.jpl.nasa.gov/horizons/', use: 'Sun and Earth positions from any lunar site' },
  { name: 'Moon Trek', by: 'NASA JPL', url: 'https://trek.nasa.gov/moon/', use: 'Moon globe imagery and maps' },
  { name: 'LOLA', by: 'NASA GSFC / LRO', url: 'https://pgda.gsfc.nasa.gov/', use: 'Terrain heights that form each horizon' },
  { name: 'LROC QuickMap', by: 'Arizona State University', url: 'https://quickmap.lroc.asu.edu/', use: 'Expert cross-check (linked, not embedded)' },
  { name: 'Moon Exploration', by: 'Canadian Space Agency', url: 'https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/', use: "Canada's role in Artemis" },
];

export function AboutPage() {
  return (
    <Page width="narrow">
      <OwnerNote owner="Goda">Citations, AI-use disclosure and team. Every image/dataset used must be listed here.</OwnerNote>
      <div>
        <Eyebrow>The project</Eyebrow>
        <DisplayHeading size="xl" align="left" accent="sources.">
          Built on NASA's
        </DisplayHeading>
      </div>
      <Lead align="left">
        Refaey on the Moon helps anyone compare lunar landing sites and dates: where the Sun and Earth sit against the real
        horizon, for power and communication.
      </Lead>
      {SOURCES.map((src) => (
        <Card key={src.name} padding="sm">
          <strong>{src.name}</strong> <span style={{ color: 'var(--color-text-muted)' }}>· {src.by}</span>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{src.use}</p>
          <Button variant="ghost" href={src.url} icon="external">
            {src.url.replace('https://', '')}
          </Button>
        </Card>
      ))}
    </Page>
  );
}
