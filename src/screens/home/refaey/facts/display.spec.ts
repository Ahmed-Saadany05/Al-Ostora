// Run: npx vitest run src/screens/home
import { describe, expect, it } from 'vitest';
import { athenaVerdict, daysAndHours, FACTS, recordedLabel, recordedTokens } from './display';
import raw from './facts.json';

describe('recorded facts → display strings', () => {
  it('the Apollo Sun angles match the engine fixture within 0.05° (and the recorded checks all passed)', () => {
    expect(raw.checks.every((c) => c.ok)).toBe(true);
    const t = recordedTokens();
    expect(t.a11Sun).toBe('10.7°');
    expect(t.a12Sun).toBe('5.1°');
    expect(t.a16Sun).toBe('14.8°');
    expect(t.a17Sun).toBe('13.3°');
  });
  it("Chang'e 4: Sun about 30° up, about four days after sunrise (so 'just after sunrise' is wrong), Earth below the horizon", () => {
    const t = recordedTokens();
    expect(t.ce4Sun).toBe('31.5°');
    expect(t.ce4SinceSunrise).toBe('4 days');
    expect(t.ce4DaylightLeft).toBe('10 days 19 hours');
    expect(t.ce4EarthBelow).toBe('39.2°');
    expect(FACTS.find((f) => f.key === 'ce4EarthMaxElevation')!.value).toBeLessThan(0);
  });
  it('Athena: Sun 2.5° up, the map is 10 m near the lander, and the engine verdict is one of two beats', () => {
    const t = recordedTokens();
    expect(t.athenaSun).toBe('2.5°');
    expect(t.athenaDemRes).toBe('10');
    expect(['sunlit', 'hidden']).toContain(athenaVerdict());
  });
  it('every fact keeps its provenance: site, coordinates, UTC time, and a Horizons URL for the elevations', () => {
    for (const f of FACTS as (typeof FACTS[number] & { target?: string })[]) {
      expect(f.siteId).toMatch(/^[a-z0-9-]+$/);
      expect(Number.isFinite(f.lat) && Number.isFinite(f.lon)).toBe(true);
      expect(f.time).toMatch(/^\d{4}-\d\d-\d\dT/);
      if (f.target) expect(f.horizonsUrl).toMatch(/^https:\/\/ssd\.jpl\.nasa\.gov\/api\/horizons/);
    }
    expect(raw.retrieved).toMatch(/^\d{4}-\d\d-\d\d$/);
  });
  it('formats', () => {
    expect(daysAndHours(5)).toBe('5 hours');
    expect(daysAndHours(24)).toBe('1 day');
    expect(daysAndHours(47.6)).toBe('2 days');
    expect(recordedLabel()).toMatch(/^JPL Horizons · recorded \d+ \w+ \d{4}$/);
  });
});
