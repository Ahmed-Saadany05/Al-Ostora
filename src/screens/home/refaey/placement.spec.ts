import { describe, expect, it } from 'vitest';
import { balloonBox, chooseSlot, clear, type PlaceCtx, type Slot } from './placement';

const ctx: PlaceCtx = { viewport: { w: 1280, h: 720 }, safe: { x: 0, y: 60, w: 1280, h: 600 }, anchor: () => null };
const floatSlot = (x: number, y: number, sides: Slot['sides'] = ['right']): Slot => ({
  id: 'f',
  pose: 'float',
  sides,
  heights: [320, 200],
  figure: (_c, s) => ({ x, y, w: s.w, h: s.h }),
});

describe('placement', () => {
  it('puts the balloon on the chosen side and grows it away from him', () => {
    const fig = { x: 100, y: 200, w: 200, h: 300 };
    expect(balloonBox('right', fig).x).toBeGreaterThan(300);
    expect(balloonBox('left', fig).x + 340).toBeLessThan(100);
    expect(balloonBox('above', fig).y + 300).toBeLessThan(200);
  });
  it('takes the first slot that fits and reads the keep-out rectangles with a 16 px margin', () => {
    const a = floatSlot(60, 100);
    expect(chooseSlot([a], ctx, [], 0.6)?.height).toBe(320);
    // text 10 px to the right of the figure: too close
    expect(clear({ x: 0, y: 0, w: 100, h: 100 }, [{ x: 110, y: 0, w: 50, h: 50 }])).toBe(false);
    expect(clear({ x: 0, y: 0, w: 100, h: 100 }, [{ x: 116, y: 0, w: 50, h: 50 }])).toBe(true);
  });
  it('tries a smaller figure, then another side, then the next slot, then gives up', () => {
    const wall = { x: 60, y: 100 + 230, w: 100, h: 40 }; // leaves 230 px of height above it
    const small = chooseSlot([floatSlot(60, 100)], ctx, [wall], 0.6);
    expect(small?.height).toBe(200);
    const left = chooseSlot([floatSlot(900, 100, ['right', 'left'])], ctx, [], 0.6);
    expect(left?.side).toBe('left'); // no room on the right of x=900 for 340 px
    const second = chooseSlot([floatSlot(60, 100), floatSlot(60, 340)], ctx, [{ x: 0, y: 90, w: 1280, h: 20 }], 0.6);
    expect(second?.figure.y).toBe(340);
    expect(chooseSlot([floatSlot(60, 100)], ctx, [{ x: 0, y: 0, w: 1280, h: 720 }], 0.6)).toBeNull();
  });
  it('never leaves the safe viewport (header and status bar)', () => {
    expect(chooseSlot([floatSlot(60, 30)], ctx, [], 0.6)).toBeNull(); // over the header
    expect(chooseSlot([floatSlot(60, 560)], ctx, [], 0.6)).toBeNull(); // into the status bar
  });
});
