# scenes/ — owner: Pink

React Three Fiber v9 + drei v10. Step pages import from `@/scenes`, and props are fixed in `contracts.ts`.

| Component | Used in | Status |
|---|---|---|
| `SitePickerGlobe` | Step 1 | **3D NASA Moon Trek globe** (pins, region outlines, click-to-pin, Imagery / LOLA relief). Falls back to the flat map (`SitePickerMap`) without WebGL |
| `SitePanorama` | Step 2 (full), Step 3 (`compact`) | 2D 360° horizon strip with Sun and Earth at their real az/el |
| `LaunchSequence` | Step 5 | Text and progress bar with Skip |
| `MoonPlaceholder` | Home hero | Shaded sphere |

- Replace the placeholders but keep the props, or agree any change with Aser.
- Use one shared `<Canvas>` with drei `<View>` for the compare cards, so the page doesn't hit the browser's WebGL context limit.
- Colours: `import { color } from '@/shared/theme/tokens'`.
- Respect `useApp((s) => s.motion)`: no auto-rotation or camera flights when motion is off.
- Credit every imagery, terrain and 3D model source to Goda (Moon Trek, LOLA, NASA 3D resources).

## Globe internals

- `globe/MoonTrekGlobe.tsx`: Moon Trek WMTS tiles on a generated 1,737.4 km sphere (`3d-tiles-renderer`: `GeneratedSurfacePlugin` + `ImageOverlayPlugin`). One scene unit = one lunar radius; children are placed in the Moon-fixed frame in metres.
- `globe/moonShading.ts`: airless lighting (Lommel–Seeliger, sharp terminator, earthshine floor). It takes a Sun direction in the Moon-fixed frame.
- `lib/moonFrame.ts`: the one coordinate convention (+Z north, +X = 0° lon), az/el → direction, exact ray pick, regions (same rule as `customSite()`).
- `lib/moonTrek.ts`: layer IDs, levels and credits. Change layers only here.
- Tests: `node --test src/scenes/lib/`.
- Credits: NASA Moon Trek / LRO WAC (NASA/GSFC/ASU) and LRO LOLA (NASA/GSFC).

