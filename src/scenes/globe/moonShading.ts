/**
 * AIRLESS MOON SHADING — added to every globe material (Moon Trek tiles and the fallback sphere).
 *
 * The tiles are unlit meshes with a photo on them, so lighting is computed from the direction
 * of each point from the Moon's centre (exact for the reference sphere):
 *  - Lunar-Lambert: mostly Lommel–Seeliger (μ0 / (μ0 + μ)), which is why the real full Moon
 *    has no darker limb, blended with a little Lambert.
 *  - A sharp terminator about one solar disk (0.53°) wide: no atmosphere to soften it.
 *  - A faint floor on the night side (earthshine): shadows are dark but not perfectly black.
 *  - No glow, haze or rim light: there is no air.
 */
import * as THREE from 'three';

export interface MoonLight {
  /** World-space unit vector pointing at the Sun. */
  uSun: { value: THREE.Vector3 };
  /** World-space centre of the Moon. */
  uMoonCentre: { value: THREE.Vector3 };
  /** Night-side brightness (earthshine), 0–1. */
  uNightFloor: { value: number };
  /** Overall exposure. Lunar soil is as dark as worn asphalt; photos are exposed brighter. */
  uExposure: { value: number };
  /** 1 = data layer (LOLA relief): show only day/night, keep the map's own shading. */
  uMaskOnly: { value: number };
}

export function createMoonLight(): MoonLight {
  return {
    uSun: { value: new THREE.Vector3(1, 0, 0) },
    uMoonCentre: { value: new THREE.Vector3() },
    uNightFloor: { value: 0.035 },
    uExposure: { value: 1.15 },
    uMaskOnly: { value: 0 },
  };
}

const SHADED = Symbol('moonShaded');
const KEY = 'moon-airless-v1';

/** Patches a material in place. Chains any existing onBeforeCompile (3d-tiles overlays use it). */
export function addMoonShading(material: THREE.Material, light: MoonLight) {
  const m = material as THREE.Material & { [SHADED]?: boolean };
  if (m[SHADED]) return;
  m[SHADED] = true;

  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.uSun = light.uSun;
    shader.uniforms.uMoonCentre = light.uMoonCentre;
    shader.uniforms.uNightFloor = light.uNightFloor;
    shader.uniforms.uExposure = light.uExposure;
    shader.uniforms.uMaskOnly = light.uMaskOnly;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMoonWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvMoonWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uSun;
        uniform vec3 uMoonCentre;
        uniform float uNightFloor;
        uniform float uExposure;
        uniform float uMaskOnly;
        varying vec3 vMoonWorld;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          vec3 nrm = normalize(vMoonWorld - uMoonCentre);
          float mu0 = dot(nrm, uSun);
          float mu = max(dot(nrm, normalize(cameraPosition - vMoonWorld)), 0.0);
          float lit0 = max(mu0, 0.0);
          float lommel = 2.0 * lit0 / (lit0 + mu + 1e-4);
          float body = mix(lit0, lommel, 0.85);
          // Half the Sun's 0.53° disk is sin(0.265°) ≈ 0.0046 above/below the horizon.
          float day = smoothstep(-0.0046, 0.0046, mu0);
          float shade = mix(day * min(body, 1.25), day, uMaskOnly);
          outgoingLight *= max(shade, uNightFloor) * uExposure;
        }
        #include <opaque_fragment>`,
      );
  };
  const previousKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${previousKey()}|${KEY}`;
  material.needsUpdate = true;
}

/** Shades every mesh in a freshly loaded tile (3d-tiles-renderer `load-model` event). */
export const shadeLoadedModel =
  (light: MoonLight) =>
  ({ scene }: { scene: THREE.Object3D }) => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => addMoonShading(mat, light));
    });
  };
