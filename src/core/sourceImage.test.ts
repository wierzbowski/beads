import { describe, expect, it } from 'vitest';
import { defaultLabels, nearestColourName } from './colourNames';
import { patternFromPixels } from './sourceImage';

type Px = [number, number, number, number?];

function pixels(rows: Px[][]): { width: number; height: number; rgba: number[] } {
  const rgba = rows.flat().flatMap(([r, g, b, a = 255]) => [r, g, b, a]);
  return { width: rows[0].length, height: rows.length, rgba };
}

const RED: Px = [255, 0, 0];
const BLUE: Px = [0, 0, 255];
const CLEAR: Px = [0, 0, 0, 0];

describe('patternFromPixels', () => {
  it('turns each pixel into a bead with exact colours, most used colour first', () => {
    const { width, height, rgba } = pixels([
      [RED, BLUE, BLUE],
      [BLUE, BLUE, RED],
    ]);
    const result = patternFromPixels(width, height, rgba, 'Wzór');
    if (!result.ok) throw new Error(result.error);
    expect(result.pattern.palette.map((c) => c.rgb)).toEqual([
      { r: 0, g: 0, b: 255 },
      { r: 255, g: 0, b: 0 },
    ]);
    expect(result.pattern.beads).toEqual([1, 0, 0, 0, 0, 1]);
    expect(result.pattern.palette.map((c) => c.label)).toEqual(['niebieski', 'czerwony']);
  });

  it('rejects transparent pixels', () => {
    const { width, height, rgba } = pixels([[RED, CLEAR]]);
    const result = patternFromPixels(width, height, rgba, 'Wzór');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/przezroczyste/);
  });

  it('rejects images over the size limit in both orientations', () => {
    const result = patternFromPixels(51, 51, new Array(51 * 51 * 4).fill(255), 'Wzór');
    expect(result.ok).toBe(false);
  });

  it('accepts a sideways image so it can be rotated', () => {
    const result = patternFromPixels(67, 17, new Array(67 * 17 * 4).fill(255), 'Wzór');
    expect(result.ok).toBe(true);
  });

  it('rejects more than 32 colours', () => {
    const row: Px[] = Array.from({ length: 33 }, (_, i) => [i, 0, 0]);
    const { width, height, rgba } = pixels([row]);
    const result = patternFromPixels(width, height, rgba, 'Wzór');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/32/);
  });
});

describe('colour names', () => {
  it('finds the nearest Polish colour name', () => {
    expect(nearestColourName({ r: 250, g: 250, b: 250 })).toBe('biały');
    expect(nearestColourName({ r: 10, g: 10, b: 10 })).toBe('czarny');
    expect(nearestColourName({ r: 250, g: 230, b: 20 })).toBe('żółty');
  });

  it('numbers repeated names', () => {
    expect(defaultLabels([{ r: 0, g: 0, b: 250 }, { r: 20, g: 20, b: 240 }, { r: 255, g: 255, b: 255 }])).toEqual([
      'niebieski',
      'niebieski 2',
      'biały',
    ]);
  });
});
