import { describe, expect, it } from 'vitest';
import { lchToRgb, rgbToLch } from './colourAdjust';

const samples = [
  { r: 0, g: 0, b: 0 },
  { r: 255, g: 255, b: 255 },
  { r: 128, g: 128, b: 128 },
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
  { r: 230, g: 190, b: 40 },
  { r: 70, g: 30, b: 110 },
];

describe('Colour Adjustment', () => {
  it('turns a colour back into itself', () => {
    for (const rgb of samples) expect(lchToRgb(rgbToLch(rgb))).toEqual(rgb);
  });

  it('changes lightness without shifting the hue', () => {
    const orange = rgbToLch({ r: 200, g: 110, b: 40 });
    const lighter = rgbToLch(lchToRgb({ ...orange, l: orange.l + 15 }));
    expect(lighter.l).toBeCloseTo(orange.l + 15, 0);
    expect(Math.abs(lighter.h - orange.h)).toBeLessThan(2);
  });

  it('keeps lightness when changing the hue', () => {
    const teal = rgbToLch({ r: 40, g: 140, b: 140 });
    const shifted = rgbToLch(lchToRgb({ ...teal, h: (teal.h + 90) % 360 }));
    expect(shifted.l).toBeCloseTo(teal.l, 0);
  });

  it('gives up just enough chroma for a colour a screen cannot show, keeping lightness and hue', () => {
    const wanted = { l: 60, c: 150, h: 200 };
    const shown = rgbToLch(lchToRgb(wanted));
    expect(shown.l).toBeCloseTo(60, 0);
    expect(Math.abs(shown.h - 200)).toBeLessThan(2);
    expect(shown.c).toBeLessThan(150);
    expect(shown.c).toBeGreaterThan(20);
  });

  it('keeps out-of-range lightness within black and white', () => {
    expect(lchToRgb({ l: 120, c: 0, h: 0 })).toEqual({ r: 255, g: 255, b: 255 });
    expect(lchToRgb({ l: -5, c: 0, h: 0 })).toEqual({ r: 0, g: 0, b: 0 });
  });
});
