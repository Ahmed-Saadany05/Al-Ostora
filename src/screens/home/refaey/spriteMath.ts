/**
 * The maths of Refaey's animation, kept pure so it can be tested: frame timing for each animation and the arc of a hop
 * under lunar gravity. The component (RefaeyActor) only plays what this describes.
 */

/** Lunar surface gravity, m/s² (NASA Moon Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html). */
export const LUNAR_G = 1.62;
/** How high he hops, metres (a modest hop: a suited astronaut on the Moon). */
export const HOP_HEIGHT_M = 0.4;
/** The suited astronaut's height the sprite is drawn at, metres (to turn metres into pixels). */
export const SUIT_HEIGHT_M = 1.8;

/** Time in the air for a hop of height h under gravity g: 2·√(2h/g). 0.4 m on the Moon: about 1.4 s. */
export const flightSeconds = (h = HOP_HEIGHT_M, g = LUNAR_G) => 2 * Math.sqrt((2 * h) / g);

/** Height above the ground (metres) t seconds into a hop that rises h: v0·t − g·t²/2, clamped to the ground. */
export function heightAt(t: number, h = HOP_HEIGHT_M, g = LUNAR_G) {
  const T = flightSeconds(h, g);
  if (t <= 0 || t >= T) return 0;
  const v0 = Math.sqrt(2 * g * h);
  return Math.max(0, v0 * t - 0.5 * g * t * t);
}

export type Anim = 'idle' | 'walk' | 'hop';

/** Idle: gentle, about 6 frames per second, ping-pong so the loop has no seam. Frame indices of one cycle. */
export function idleCycle(count: number): number[] {
  const up = Array.from({ length: count }, (_, i) => i);
  return [...up, ...up.slice(1, -1).reverse()];
}
export const IDLE_FRAME_MS = 1000 / 6;
/** Walk: about 12 frames per second. */
export const WALK_FRAME_MS = 1000 / 12;
export const WALK_IN_MAX_S = 1.2;

/**
 * Hop: frames 0–2 crouch (fast), the airborne frames are held across the real flight time, the landing frames are fast.
 * Returns a duration in ms for every frame, in order, and which frames are in the air (the arc is applied to those).
 */
export function hopTimeline(count: number, h = HOP_HEIGHT_M, g = LUNAR_G) {
  const crouch = 3;
  const land = 3;
  const air = count - crouch - land;
  const flightMs = flightSeconds(h, g) * 1000;
  const durations = Array.from({ length: count }, (_, i) => (i < crouch ? 70 : i >= count - land ? 80 : flightMs / air));
  const takeoffMs = durations.slice(0, crouch).reduce((a, b) => a + b, 0);
  return { durations, takeoffMs, flightMs, totalMs: durations.reduce((a, b) => a + b, 0) };
}

/** Which frame is showing `tMs` into a sequence of per-frame durations (the last frame holds). */
export function frameAt(durations: number[], tMs: number) {
  let acc = 0;
  for (let i = 0; i < durations.length; i++) {
    acc += durations[i];
    if (tMs < acc) return i;
  }
  return durations.length - 1;
}

/** Pixels to lift the sprite `tMs` into a hop: only while airborne (between take-off and landing), scaled so the suit is 1.8 m tall. */
export function hopLiftPx(tMs: number, spriteHeightPx: number, count: number) {
  const { takeoffMs } = hopTimeline(count);
  const t = (tMs - takeoffMs) / 1000;
  return heightAt(t) * (spriteHeightPx / SUIT_HEIGHT_M);
}
