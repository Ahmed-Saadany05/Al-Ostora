# Refaey on the Moon

**Lunar Landing Site Navigator**: Team Al Ostora, NASA Space Apps Cairo 2026.
Compare lunar landing sites and dates by seeing where the Sun and Earth sit against the real horizon, for power and communication.

> ⏰ Final submission: **Sat 14 Nov, 14:00 Cairo**. `main` must always run.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

- On npm 12, a warning that `esbuild` install scripts were blocked is harmless; the dev server and build work anyway.
- `/kit` shows every shared UI component, live. Look there first.
- `npm run typecheck` must pass before you open a PR.
- `npm run build` creates the production build in `dist/`.
- Demo data is the default. When the engine lands, run `VITE_DATA_PROVIDER=live npm run dev`.

## The mission flow

The top bar has only **Explore · Plan a mission · The project**. Everything else is one guided flow. Its state lives in the URL, so reloads, the back button and shared links all work. Build links with `missionUrl` from `@/shared/mission`.

| Step | URL | Screen (owner) |
|---|---|---|
| 0 | `/` | Home → "Begin the journey" (Hady) |
| 1 | `/mission?sites=a,b` | Choose your site: globe with pins, list, custom coordinates. 1 site → Stand; 2–4 → Compare (Aser + Pink `SitePickerGlobe`) |
| 2 | `/mission/stand?site=a` | Stand on site: panorama, Sun/Earth cards, timeline, Verify drawer (Aser + Pink `SitePanorama`) |
| 3 | `/mission/compare?sites=a,b,c&by=sites\|dates` | Compare cards: rings, best window, match score (Aser + Pink compact `SitePanorama`) |
| 4 | `/mission/date?site=a` | Pick a launch date; landing date and conditions at touchdown (Aser) |
| 5 | `/mission/launch?site=a&launch=ISO` | Launch → landing animation, then mission summary (Pink `LaunchSequence` + Aser) |

Custom coordinates are site ids like `custom:-89.450_-137.300`, so they survive reloads.
Scene props are fixed in `src/scenes/contracts.ts`: Pink owns the implementation and Aser lays his cards and controls over it.

## Folder map: touch only your own folder

| Folder | Owner | What |
|---|---|---|
| `src/shared/` | **Hagras** | Types, data hooks, tokens, UI kit, stores (ask before changing) |
| `src/app/` | **Hagras** | Shell, nav, status bar, router, `/kit` |
| `src/data/` | **Hagras** | Horizons client, site catalogue, LOLA horizon files |
| `api/` | **Hagras** | `/api/horizons` serverless proxy |
| `src/engine/` | **Goda** | Science engine, which registers the `live` provider |
| `src/scenes/` | **Pink** | Site-picker globe, site panorama, launch sequence (R3F). Keep `contracts.ts` props |
| `src/screens/planner/` | **Aser** | The mission flow steps 1–5, plus the Verify drawer |
| `src/screens/home/` | **Hady** | Home, plus plain-language explainers used inside the steps |
| `src/screens/about/` | **Goda** | Sources, credits, AI-use disclosure |

**Adding a screen:** add the route to your own `routes.tsx` (for example `src/screens/planner/routes.tsx`). You don't need to edit the router.

## The rules

1. **Tokens and kit only.** Import UI from `@/shared/ui` and use `var(--token)` from `src/shared/theme/tokens.css`. No hex colours or font names in your CSS. For three.js and canvas, use `@/shared/theme/tokens`.
2. **Data only through hooks.** Use `useSites`, `useSky`, `useDayReport`, `useMetrics`, `useHorizon` and `usePlanLaunch` from `@/shared/data`, and `useMission()` for the flow's sites and dates. Never invent a number in a screen. Show `<SourceBadge source={x.source}/>` next to data, so demo values are always labelled.
3. **Time:** everything is UTC ISO strings. Read the global clock with `useTime((s) => s.time)` and format with `@/shared/format`.
4. **UI principles:**
   - one `variant="primary"` button per screen
   - every `<Panel>` needs a `next` action
   - numbers go in `<Metric>` or `className="num"` with units
   - `<Pill>` always needs an icon and a label
5. **Branches:** one branch per task (`aser/compare-screen`). Open a PR into `main` and get one teammate's review before merging.
6. **Credits:** every image or dataset you use goes to Goda for `/about`.
7. **Desktop first** (1280–1920 px).

## Data flow

```
JPL Horizons ─┐                                       ┌─ screens/planner
  (/api/horizons proxy)                               ├─ screens/home
LOLA terrain ─┼─► src/data ─► src/engine (live) ──────┤
Site catalogue┘          DataProvider interface ──────┤
                         src/shared/data/demo (demo) ─┘─ scenes
```

Both providers implement `DataProvider` (`src/shared/data/provider.ts`), so screens never change when we switch.

## Horizons proxy

`GET /api/horizons?target=sun|earth&lat=-89.67&lon=129.78&start=2026-11-13T00:00Z&stop=2026-11-14T00:00Z&step=1h`

The response is `{ rows: [{ time, azDeg, elDeg, angularDiameterDeg, distanceKm }], horizonsUrl, … }`. From the browser, use `fetchHorizons()` in `src/data/horizons/client.ts`. Locally, the Vite dev server runs the same handler as the deployed serverless function (`api/_lib/horizons-handler.ts`).

## Deploy

The repo is ready for Vercel: `vercel.json` plus `api/horizons.ts`. Import the GitHub repo in Vercel; it needs no environment variables.

## Sources

JPL Horizons (NASA JPL) · Moon Trek (NASA JPL) · LOLA (NASA GSFC/LRO) · LROC QuickMap (ASU) · CSA Moon Exploration. The full citations and the AI-use disclosure are on `/about`.

Fonts: DM Sans, DM Mono and Instrument Serif (SIL Open Font License), self-hosted through Fontsource.
