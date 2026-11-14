import { describe, expect, it } from 'vitest';
import { flightSeconds, frameAt, heightAt, hopLiftPx, hopTimeline, idleCycle, LUNAR_G } from './spriteMath';

describe('sprite maths', () => {
  it('a 0.4 m hop under 1.62 m/s² hangs about 1.4 s (Earth gravity: 0.57 s)', () => {
    expect(flightSeconds(0.4, LUNAR_G)).toBeCloseTo(1.405, 2);
    expect(flightSeconds(0.4, 9.81)).toBeCloseTo(0.571, 2);
  });
  it('the arc rises to exactly the hop height at mid-flight and is on the ground at both ends', () => {
    const T = flightSeconds();
    expect(heightAt(T / 2)).toBeCloseTo(0.4, 3);
    expect(heightAt(0)).toBe(0);
    expect(heightAt(T)).toBe(0);
    expect(heightAt(T / 4)).toBeLessThan(heightAt(T / 2));
  });
  it('idle is a ping-pong with no repeated frame at the seam', () => {
    expect(idleCycle(8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1]);
    expect(idleCycle(8).at(-1)).not.toBe(idleCycle(8)[0]);
  });
  it('the hop: fast crouch, frames held across the real flight, fast landing', () => {
    const t = hopTimeline(12);
    expect(t.durations.slice(0, 3)).toEqual([70, 70, 70]);
    expect(t.durations.slice(9)).toEqual([80, 80, 80]);
    expect(t.durations.slice(3, 9).reduce((a, b) => a + b, 0)).toBeCloseTo(t.flightMs, 3);
    expect(t.totalMs).toBeCloseTo(210 + 240 + t.flightMs, 3);
    expect(frameAt(t.durations, 0)).toBe(0);
    expect(frameAt(t.durations, t.takeoffMs + 1)).toBe(3);
    expect(frameAt(t.durations, t.totalMs + 500)).toBe(11);
  });
  it('the lift is zero on the ground and about 0.22 × the sprite height at the top', () => {
    const t = hopTimeline(12);
    expect(hopLiftPx(0, 440, 12)).toBe(0);
    expect(hopLiftPx(t.takeoffMs + t.flightMs / 2, 440, 12)).toBeCloseTo((0.4 / 1.8) * 440, 1);
    expect(hopLiftPx(t.totalMs, 440, 12)).toBe(0);
  });
});
