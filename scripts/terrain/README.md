# 3D terrain tiles: owner Hagras

Real NASA ground for the "stand on site" 3D view (Pink's `MoonView3D`).

```bash
npm run terrain                      # every catalogue site with a data source
npm run terrain -- connecting-ridge  # one site
```

Per site this writes a **12 × 12 km grid at 20 m** (601 × 601), centred on the site, north-up, as int16 decimetres relative to the site's height:
- `public/terrain/<id>.i16`: ~0.7 MB, downloaded by the app only when that site is opened
- `src/data/terrain/sites.json`: metadata (source map, resolution, relief, site height)

`src/data/terrain/index.ts` turns a tile into the view's `TerrainSource` and applies the Moon's curvature (−d²/2R). `SitePanorama` uses it when present and keeps the placeholder otherwise. The view labels the ground "Real terrain · NASA LOLA 10 m" or "… SLDEM2015 59 m".

## Data
- **South of 60° S:** NASA PGDA LOLA maps (Barker 2023): 10 m → 20 m → 30 m → 60 m, whichever loads. Gaps are filled from the cached 80 m / 240 m maps, never with made-up values.
- **60° S – 60° N:** NASA **SLDEM2015** (LOLA + Kaguya, PGDA product 54, Barker et al. 2016), 512 px/deg ≈ 59 m. It's read row by row with HTTP range requests (`sldem.mjs`), so nothing is downloaded whole.
- **Not covered:** Hakuto-R M2 (60.4° N), which keeps the placeholder.

## Geometry
Grid points are placed along great circles from the site (bearing atan2(east, north), distance hypot), the same geometry as the horizon rays. The 3D ground's skyline therefore matches the horizon files: at Connecting Ridge, within ~0.1° in most directions.

Beyond the 6 km patch, the view draws a **skyline ring from the site's horizon profile**, so the distant terrain and the cards always agree.

## Cosmetic, labelled as such
The view adds a small-scale regolith bump texture (small craters, grain) and a little bounce light. Both affect shading only, never heights, the skyline or any number.
