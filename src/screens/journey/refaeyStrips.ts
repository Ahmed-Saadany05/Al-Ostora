/** Refaey's animation strips for the 3D scenes (Hady's art, cut from the sprite sheets). Feet gaps measured on the art. */
import type { Strip } from '@/scenes/moonview/Guide3D';
import sprites from '@/screens/home/refaey/art/sprites.json';
import idleStrip from '@/screens/home/refaey/art/idle-strip.webp';
import walkStrip from '@/screens/home/refaey/art/walk-strip.webp';

export const IDLE: Strip = { url: idleStrip, ...sprites.idle, feetGap: 5, fps: 6 };
export const WALK: Strip = { url: walkStrip, ...sprites.walk, feetGap: 5, fps: 12 };

/** A point on the ground `d` metres away at azimuth `azDeg` (x east, z south). */
export const groundPoint = (azDeg: number, d: number) => ({ x: d * Math.sin((azDeg * Math.PI) / 180), z: -d * Math.cos((azDeg * Math.PI) / 180) });
