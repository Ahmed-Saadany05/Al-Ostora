/**
 * Type shim for 3d-tiles-renderer@0.5.4: `GeneratedSurfacePlugin` ships in the JS build
 * (exported from '3d-tiles-renderer/plugins') but has no .d.ts yet. Options are copied from
 * the library's API.md. Remove this file when the package publishes its own types.
 */
import type { ImageOverlay } from '3d-tiles-renderer/plugins';

declare module '3d-tiles-renderer/plugins' {
  export class GeneratedSurfacePlugin {
    constructor(options?: {
      overlay?: ImageOverlay | null;
      projection?: 'ellipsoid' | 'source' | string;
      endCaps?: boolean;
      center?: boolean;
      useRecommendedSettings?: boolean;
      applyOverlayTexture?: boolean;
    });
  }
}
