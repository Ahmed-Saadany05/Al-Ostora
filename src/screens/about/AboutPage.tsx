/** Owner: Goda — the project page: sources, credits, licence. AI-use disclosure is added at submission. */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Card, Divider, DisplayHeading, Eyebrow, Lead, OwnerNote, Page } from '@/shared/ui';

/**
 * Required citation format (JPL Horizons). Update the date to the day the final data
 * (live calls and recorded fixtures) was retrieved, in Horizons' YYYY-MON-DD form.
 */
const HORIZONS_RETRIEVED = '2026-NOV-14';
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
  '3-D terrain outside the poles: SLDEM2015, LRO LOLA + SELENE/Kaguya Terrain Camera (NASA/GSFC, JAXA)',
  'Earth photo (launch date, summary): NASA Apollo 17 "Blue Marble" (AS17-148-22727)',
  '3-D Earth texture (launch orbit, summary globe): three.js example textures (MIT licence); original source not stated',
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
      { text: 'NASA PGDA product 81 — LOLA 5 m south-pole mosaic (Barker et al. 2021)', url: 'https://pgda.gsfc.nasa.gov/products/81', use: 'Terrain within 3 km of the polar sites' },
      { text: 'Barker et al. 2016 — SLDEM2015 (LOLA + SELENE/Kaguya), NASA PGDA product 54', url: 'https://pgda.gsfc.nasa.gov/products/54', use: '3-D terrain for sites between 60°S and 60°N' },
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

/**
 * "Use of AI" disclosure (Space Apps requires a complete, brief list of AI uses).
 * One entry per person, in their own words. TODO before submission: Hagras, Aser, Pink, Hady.
 */
const AI_USE: { who: string; tool: string; uses: string }[] = [
  {
    who: 'Goda (science engine, screens, quality)',
    tool: 'Claude (Anthropic), via Claude Code',
    uses: 'Finding and cross-checking sources; writing the science engine and its tests to the team\'s specification; checking the engine against JPL Horizons and NASA\'s long-term sunlight maps; fixing and simplifying screens (site choice, launch date, mission summary); code reviews; drafting this page, the video script and team messages.',
  },
  {
    who: 'Hagras (data, terrain, 3D)',
    tool: 'Claude Code; Manus AI',
    uses: 'Claude Code: writing and debugging code (data pipeline, NASA terrain, 3D scenes, UI). Manus AI: generating the 3D hardware models.',
  },
  // { who: 'Aser (screens)', tool: '…', uses: '…' },
  {
    who: 'Pink (3D scenes, page flow)',
    tool: 'Claude Code (Claude Opus)',
    uses: 'Building the 3D scenes (the Moon Trek globe and site picker, the Home to site-selection flight, the stand-on-site Moon view, the launch orbit and the summary Moon), the page flow changes, and bug fixes.',
  },
  {
    who: 'Hady (Home, explainers, Refaey)',
    tool: 'Claude Code (Sonnet 5.5, Opus 5.5 as advisor); Claude (Opus 5.5, chat); Claude Design; an AI 3D image tool (name to be confirmed)',
    uses: "Claude Code: writing the Home page, Refaey's conversations, the past-missions page, his animations and the tests. Claude chat: planning, writing the Claude Code prompts, fact-checking against NASA/JPL sources, and drafting Refaey's lines (checked against the sources). Refaey's images are AI-made: his flat drawings with Claude Design, his 3D renders and animation frames with an AI 3D image tool (original character, not based on anyone); they carry an 'AI' label in the app. Not AI: every mission fact and number (JPL Horizons, NASA and agency pages) and the mission card photos (real NASA/agency photos, credited on each card).",
  },
];

const muted = { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' } as const;

export function AboutPage() {
  const { hash } = useLocation();
  // The page renders after the browser's own hash jump, so jump to '#methods' ourselves.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <Page width="narrow">
      <OwnerNote owner="Goda">Before submission: add each teammate's AI use to AI_USE (Hagras, Aser, Pink, Hady), then remove this note.</OwnerNote>
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
      {/* Anchor target for explainer sources ('/about#methods'). */}
      <div id="methods" style={{ scrollMarginTop: '140px' }}>
        <Eyebrow as="h2">References</Eyebrow>
      </div>
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
      <Eyebrow as="h2">Use of AI</Eyebrow>
      <Card padding="sm">
        <p style={muted}>
          We used AI tools as helpers. The idea, the design and every scientific decision were the team's. Every number in the
          app comes from the NASA data listed above and was checked against published NASA values.
        </p>
        <ul style={{ margin: 'var(--space-2, 8px) 0 0', paddingLeft: '1.1em' }}>
          {AI_USE.map((a) => (
            <li key={a.who} style={{ marginBottom: 'var(--space-2, 8px)' }}>
              <strong>{a.who}</strong> <span style={{ color: 'var(--color-text-muted)' }}>· {a.tool}</span>
              <div style={muted}>{a.uses}</div>
            </li>
          ))}
        </ul>
      </Card>

      <Divider />
      <Eyebrow as="h2">Licence</Eyebrow>
      <p style={muted}>Code released under the Apache License 2.0.</p>
    </Page>
  );
}
