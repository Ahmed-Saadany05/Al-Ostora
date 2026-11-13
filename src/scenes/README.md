# scenes/ — owner: Pink

React Three Fiber v9 + drei v10. Step pages import from `@/scenes`, and props are fixed in `contracts.ts`.

| Component | Used in | Placeholder now |
|---|---|---|
| `SitePickerGlobe` | Step 1 | Flat 2D map with pins; click to get coordinates |
| `SitePanorama` | Step 2 (full), Step 3 (`compact`) | 2D 360° horizon strip with Sun and Earth at their real az/el |
| `LaunchSequence` | Step 5 | Text and progress bar with Skip |
| `MoonPlaceholder` | Home hero | Shaded sphere |

- Replace the placeholders but keep the props, or agree any change with Aser.
- Use one shared `<Canvas>` with drei `<View>` for the compare cards, so the page doesn't hit the browser's WebGL context limit.
- Colours: `import { color } from '@/shared/theme/tokens'`.
- Respect `useApp((s) => s.motion)`: no auto-rotation or camera flights when motion is off.
- Credit every imagery, terrain and 3D model source to Goda (Moon Trek, LOLA, NASA 3D resources).
