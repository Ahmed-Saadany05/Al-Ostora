# engine/ — owner: Goda

The science engine: Sun/Earth vs the terrain horizon, visibility windows, countdowns, power and comms scores.

**Contract:** build a `DataProvider` with `id: 'live'` (see `src/shared/data/provider.ts`) and register it:

```ts
import { registerProvider } from '@/shared/data';
registerProvider(liveProvider);
```

Then run with `VITE_DATA_PROVIDER=live npm run dev`. Screens switch automatically and the status bar flips from "Demo data" to "Live NASA data".

Inputs you can use (from `src/data/`, owner Hagras):
- `fetchHorizons({ target, lat, lon, start, stop, step })`: Sun/Earth az/el from JPL Horizons via our proxy
- Site catalogue and LOLA horizon profiles (`HorizonProfile`), arriving Saturday morning

Reusable helpers: `windowsFrom`, `longestGapH`, `nextTransition` in `@/shared/data`. The demo model in
`src/shared/data/demo/demoModel.ts` shows the expected shapes, and its disk-clip math may help.

Physics note, checked against Horizons: Sun elevation at **−89.67°, 129.78°E** (roughly Shackleton crater's centre — *not* the rim; earlier docs mislabelled it) reached **+1.88°** on 13 Nov 2026.
The "≤ 1.5°" rule is for the pole itself, so don't clamp.
