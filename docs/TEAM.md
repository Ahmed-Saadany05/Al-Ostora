# Team scopes after the mission-flow restructure

The shared rules in the README are unchanged. This page lists only what each person builds now.
Deadline: **Sat 14 Nov, 14:00 Cairo**, with the last hour kept for testing and submitting.

## Hagras: foundation + data
- Done: the flow shell (`/mission/*`), URL state (`@/shared/mission`), and the new kit pieces: `ProgressRing`, `TimelineStrip`, `StepHeader`, `DateField`.
- Done: the new type fields `bothFraction`, `bestWindow` and `matchScore`, plus `LaunchPlan` / `planLaunch`, with demo values for all of them.
- Next: GitHub and Vercel deploy, the site catalogue, LOLA horizon files, recorded Horizons fixtures for the demo queries.

## Aser: the mission flow screens (`src/screens/planner/`)
Every step already has a working placeholder. Replace each one with the real design.
1. **Choose your site:** list, search, custom-coordinates form, multi-select (up to 4).
2. **Stand on site:** Sun and Earth cards (elevation, next set/rise, look toward), timeline with play and "Jump to best", Stand here / Fly above toggle.
3. **Compare:** cards with rings, a timeline strip, best window, longest darkness and match score; the Sites / Dates toggle; a "Best match" summary.
4. **Launch date:** launch → touchdown, with conditions at touchdown.
5. **Mission summary** after the launch animation.
- Verify and settings are drawers, not pages. The old calendar and reports screens are folded into the timeline and the compare view.
- Keep it uncrowded: two body cards, one timeline and one primary action per step.

## Pink: scenes (`src/scenes/`)
Implement the components in `contracts.ts` and keep their props:
- `SitePickerGlobe`: Moon Trek globe, site pins, click empty terrain → `onPickCoords(lat, lon)`.
- `SitePanorama`: the "stand here" first-person terrain view you can drag around, with Sun and Earth at their real az/el; plus `mode="above"` (fly-over) and `compact` (compare cards).
  - Use **one shared Canvas with drei `<View>`**, because four card views plus the globe would exceed the browser's WebGL limit.
- `LaunchSequence`: launch → touchdown. This is a "Should": make it skippable and respect Motion off. Use a real vehicle and lander (never the Shuttle), ideally a model from NASA's 3D resources, credited to Goda.

## Goda: engine, pitch and quality
- Engine adds `bothFraction`, `bestWindow` (longest stretch of Sun and Earth together), `matchScore` (explain the formula in the UI), and `planLaunch` with a labelled transit-time assumption.
- `getSky` runs on every clock tick, so fetch Horizons once per range and interpolate.
- Comparing dates: one site over several lunar days (`by=dates`).
- The pitch and demo script follow the 5 steps.

## Hady: Home + explainers
- Home stays, and "Begin the journey" goes to `/mission`.
- My Sky and lessons are no longer pages. Write short plain-language "What's this?" explainers for use inside the steps, for example:
  - why the Sun stays low at the pole
  - libration
  - why the far side never sees Earth
  - what the "best window" means
