/** Owner: Goda — the project page: sources, credits, licence. AI-use disclosure is added at submission. */
import { Button, Card, Divider, DisplayHeading, Eyebrow, Lead, OwnerNote, Page } from '@/shared/ui';

/**
 * Required citation format (JPL Horizons). Update the date to the day the final data
 * (live calls and recorded fixtures) was retrieved, in Horizons' YYYY-MON-DD form.
 */
const HORIZONS_RETRIEVED = '2026-NOV-13';
const HORIZONS_CITATION = `Giorgini, JD and JPL SSD Group, NASA/JPL Horizons On-Line Ephemeris System, https://ssd.jpl.nasa.gov/horizons/, data retrieved ${HORIZONS_RETRIEVED}`;

const SOURCES = [
  { name: 'JPL Horizons', by: 'NASA JPL', url: 'https://ssd.jpl.nasa.gov/horizons/', use: 'Sun and Earth positions from any lunar site' },
  { name: 'Moon Trek', by: 'NASA JPL', url: 'https://trek.nasa.gov/moon/', use: 'Moon globe imagery and maps' },
  { name: 'LOLA', by: 'NASA GSFC / LRO', url: 'https://pgda.gsfc.nasa.gov/', use: 'Terrain heights that form each horizon' },
  { name: 'LROC QuickMap', by: 'Arizona State University', url: 'https://quickmap.lroc.im-ldi.com/', use: 'Expert cross-check (linked, not embedded)' },
  { name: 'Moon Exploration', by: 'Canadian Space Agency', url: 'https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/', use: "Canada's role in Artemis" },
];

/** Image credits, exactly as each provider asks. */
const CREDITS = [
  'Moon imagery: NASA Moon Trek / LRO WAC (NASA/GSFC/Arizona State University)',
  'Terrain: LRO LOLA (NASA/GSFC)',
];

interface Ref {
  text: string;
  url: string;
  use: string;
}

/** What the science engine is built on. Every number in the app traces back to one of these. */
const REFERENCES: { group: string; refs: Ref[] }[] = [
  {
    group: 'Sun and Earth positions',
    refs: [
      { text: HORIZONS_CITATION, url: 'https://ssd.jpl.nasa.gov/horizons/', use: 'Sun and Earth direction, distance and size, seen from each site' },
      { text: 'NASA GSFC, Lunar eclipses 2021–2030', url: 'https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html', use: 'Cross-check for eclipses seen from the Moon' },
    ],
  },
  {
    group: 'Terrain and sunlight maps',
    refs: [
      { text: 'Barker et al. 2023, PSJ 4:183 — NASA PGDA product 90 (LOLA south pole)', url: 'https://pgda.gsfc.nasa.gov/products/90', use: 'Terrain, slope (100 m baseline) and shadowed regions' },
      { text: 'Mazarico et al. 2011, Icarus 211:1066–1081 — NASA PGDA product 69', url: 'https://pgda.gsfc.nasa.gov/products/69', use: 'Long-term sunlight and Earth-visibility reference values' },
      { text: 'Barker et al. 2021, Planet. Space Sci. 203:105119', url: 'https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf', use: 'Horizon method (terrain detail near and far)' },
      { text: 'Gläser et al. 2018, Planet. Space Sci. 162:170–178', url: 'https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf', use: 'Sunlight values for validation' },
    ],
  },
  {
    group: 'Landing sites',
    refs: [
      { text: 'NASA Lunar Surface Data Book, M2M-30044 (2025)', url: 'https://ntrs.nasa.gov/api/citations/20250002845/downloads/M2M-30044%20Lunar%20Surface%20Data%20Book%20Baseline_Final.pdf', use: 'South-pole region points and the 150 h darkness (battery) limit' },
      { text: 'LROC landed-object coordinates (NASA/GSFC/Arizona State University)', url: 'https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_ANTHROPOGENIC_OBJECTS', use: 'Measured landing coordinates of past missions' },
      { text: 'NASA NSSDCA, Apollo landing sites', url: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html', use: 'Apollo landing times' },
      { text: 'Fjeld & Scotti, Apollo Lunar Surface Journal: Sun and Earth altitudes and azimuths', url: 'https://www.apollojournals.org/alsj/alsj-EarthSun_AltAz.html', use: 'Validation: Sun elevation at the Apollo landings' },
    ],
  },
  {
    group: 'Power',
    refs: [
      { text: 'Kopp & Lean 2011, Geophys. Res. Lett. — total solar irradiance 1360.8 W/m²', url: 'https://espo.nasa.gov/node/30086', use: 'Sunlight power at 1 AU' },
      { text: 'Spectrolab XTJ Prime solar cell datasheet', url: 'https://www.spectrolab.com/photovoltaics/XTJ-Prime_Data_Sheet.pdf', use: 'Solar cell efficiency (30.7 %)' },
    ],
  },
];

const muted = { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' } as const;

export function AboutPage() {
  return (
    <Page width="narrow">
      <OwnerNote owner="Goda">AI-use disclosure is added at submission; update HORIZONS_RETRIEVED to the final data date.</OwnerNote>
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
          <p style={muted}>{src.use}</p>
          <Button variant="ghost" href={src.url} icon="external">
            {src.url.replace('https://', '')}
          </Button>
        </Card>
      ))}

      <Divider />
      <Eyebrow as="h2">Image credits</Eyebrow>
      <Card padding="sm">
        {CREDITS.map((c) => (
          <p key={c} style={muted}>
            {c}
          </p>
        ))}
      </Card>

      <Divider />
      <Eyebrow as="h2">References</Eyebrow>
      {REFERENCES.map(({ group, refs }) => (
        <Card key={group} padding="sm">
          <strong>{group}</strong>
          <ul style={{ margin: 'var(--space-2, 8px) 0 0', paddingLeft: '1.1em' }}>
            {refs.map((r) => (
              <li key={r.url + r.text} style={{ marginBottom: 'var(--space-2, 8px)' }}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationThickness: '1px' }}
                >
                  {r.text}
                </a>
                <div style={muted}>{r.use}</div>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <Divider />
      <Eyebrow as="h2">Licence</Eyebrow>
      <p style={muted}>Code released under the Apache License 2.0.</p>
    </Page>
  );
}
