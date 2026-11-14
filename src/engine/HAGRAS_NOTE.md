# For Hagras: shared changes the engine needs

The engine works today against the current contract, and these would make it cleaner. None of them is done in shared code; they're your call.

1. **`src/shared/types.ts`**, additive:
   - `SkyState`: `requestedTime?: IsoTime`, `fallback?: 'nearest-recorded'`, `eclipse?: 'none' | 'partial' | 'total'`, `sunTerrainFraction?: number`
   - `Params`: `panelAzimuthDeg?: number` (needed by `vertical-fixed`), `launchTime?: IsoTime`, `transitId?: string`, `landingTime?: IsoTime` (gates are judged at launch + transit)
   - `SiteMetrics`: `relativeEnergyPct?`, `darknessScore?`, `gates?`, `notModelled?: string[]`
   - `DataProvider.planLaunch(site, launchDate, transitId?)`
   - Today these live in `src/engine/types.ts` as extensions.
2. **`DEFAULT_PARAMS.scoreWeights`** is 0.4/0.3/0.3 with a TODO. The decided default is ⅓ each.
   - If a screen passes `DEFAULT_PARAMS` whole, its weights override the engine's.
   - Also suggest `panelType: 'vertical-rotating'` and `maxDarknessH: 150`.
3. **Register the engine**: one line `import '@/engine';` in `src/main.tsx` (or wherever you prefer).
4. **`package.json`**: added `vitest` (dev) and `"test": "vitest run src/engine"`.
5. **Proxy**: quantity 10 → `illuminationPct` on Earth rows. The engine already reads it if present; until then it computes illumination from geometry.
6. **Catalogue**: `connecting-ridge` is −89.468, −137.4. The decided point is NASA Data Book R01 (−89.4632, −137.49), labelled "Connecting Ridge (NASA Data Book centre point)".
7. **Horizon files**: the engine loads `src/data/horizons-lola/<site.id>.json` (`HorizonProfile`, 0.5° step, 720 values, `terrain: 'lola'`).
   - It checks the file covers 360°.
   - Custom sites never use a catalogue file.
8. **Fixtures**: the engine indexes every file in `src/data/horizons/fixtures/` by `query.target/lat/lon`, so any range works offline. Exact key names don't matter to the engine.
