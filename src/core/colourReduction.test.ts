import { describe, expect, it } from 'vitest';
import { createColourReducer, reduceColours } from './colourReduction';
import { fingerprint } from './fingerprint';
import type { Pattern, Rgb } from './pattern';
import { patternFromRows } from './testPatterns';

const RED: Rgb = { r: 220, g: 20, b: 30 };
const ALMOST_RED: Rgb = { r: 218, g: 22, b: 31 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const PINK: Rgb = { r: 255, g: 180, b: 190 };
const BLUE: Rgb = { r: 30, g: 80, b: 210 };
const LIGHT_BLUE: Rgb = { r: 150, g: 190, b: 255 };

/** A one-row base pattern with the given colours and bead counts, most used first. */
function base(entries: [Rgb, number][]): Pattern {
  const beads = entries.flatMap(([, count], i) => new Array<number>(count).fill(i));
  return {
    name: 'Wzór',
    width: beads.length,
    height: 1,
    palette: entries.map(([rgb]) => ({ rgb, label: '' })),
    beads,
  };
}

const colours = (p: Pattern) => p.palette.map((c) => c.rgb);

describe('Colour Reduction', () => {
  it('folds near-identical shades into the most used one on import', () => {
    const b = base([
      [RED, 10],
      [BLUE, 5],
      [ALMOST_RED, 2],
    ]);
    const reducer = createColourReducer(b);
    expect(reducer.maxColours).toBe(2);
    const reduced = reduceColours(b, reducer, reducer.maxColours);
    expect(colours(reduced)).toEqual([RED, BLUE]);
    expect(reduced.beads.filter((c) => c === 0)).toHaveLength(12);
  });

  it('merges rare stray colours before large deliberate ones', () => {
    const b = base([
      [BLUE, 300],
      [LIGHT_BLUE, 200],
      [RED, 100],
      [WHITE, 100],
      [PINK, 3],
    ]);
    const reducer = createColourReducer(b);
    const reduced = reduceColours(b, reducer, 4);
    // Pink is closest to white, which now has 103 beads and so sorts ahead of red.
    expect(colours(reduced)).toEqual([BLUE, LIGHT_BLUE, WHITE, RED]);
    expect(reduced.palette[reduced.beads[reduced.beads.length - 1]].rgb).toEqual(WHITE);
  });

  it('only ever uses exact colours from the source', () => {
    const entries: [Rgb, number][] = Array.from({ length: 60 }, (_, i) => [
      { r: (i * 37) % 256, g: (i * 91) % 256, b: (i * 53) % 256 },
      1 + (i % 7),
    ]);
    const b = base(entries);
    const reducer = createColourReducer(b);
    const source = new Set(entries.map(([c]) => `${c.r},${c.g},${c.b}`));
    for (const target of [32, 10, 3]) {
      const reduced = reduceColours(b, reducer, target);
      expect(reduced.palette).toHaveLength(target);
      for (const c of colours(reduced)) expect(source.has(`${c.r},${c.g},${c.b}`)).toBe(true);
    }
  });

  it('caps the slider at 32 colours and clamps targets', () => {
    const entries: [Rgb, number][] = Array.from({ length: 40 }, (_, i) => [{ r: i * 6, g: 255 - i * 6, b: (i * 97) % 256 }, 1]);
    const b = base(entries);
    const reducer = createColourReducer(b);
    expect(reducer.maxColours).toBe(32);
    expect(reducer.minColours).toBe(2);
    expect(reduceColours(b, reducer, 99).palette).toHaveLength(32);
    expect(reduceColours(b, reducer, 0).palette).toHaveLength(2);
  });

  it('handles a single-colour image', () => {
    const b = base([[WHITE, 5]]);
    const reducer = createColourReducer(b);
    expect([reducer.minColours, reducer.maxColours]).toEqual([1, 1]);
    expect(colours(reduceColours(b, reducer, 1))).toEqual([WHITE]);
  });

  it('handles noisy images with thousands of shades', () => {
    const entries: [Rgb, number][] = Array.from({ length: 4000 }, (_, i) => [
      { r: i % 256, g: Math.floor(i / 16) % 256, b: (i * 7) % 256 },
      1,
    ]);
    const b = base(entries);
    const reducer = createColourReducer(b);
    expect(reducer.maxColours).toBe(32);
    expect(reduceColours(b, reducer, 8).palette).toHaveLength(8);
  });

  it('keeps labels of surviving colours and names the rest', () => {
    const b = base([
      [BLUE, 300],
      [RED, 100],
      [WHITE, 100],
      [PINK, 3],
    ]);
    const reducer = createColourReducer(b);
    const before = reduceColours(b, reducer, 4);
    const renamed = {
      ...before,
      name: 'Moja nazwa',
      palette: before.palette.map((c) => (c.rgb === BLUE ? { ...c, label: 'DB-0726' } : c)),
    };
    const after = reduceColours(b, reducer, 3, renamed);
    expect(after.name).toBe('Moja nazwa');
    expect(after.palette.map((c) => c.label)).toEqual(['DB-0726', 'biały', 'czerwony']);
  });

  it('leaves a pattern loaded from a link unchanged when cleanup is off', () => {
    const linked = patternFromRows(['RGB', 'WKR']);
    linked.palette[0].rgb = RED;
    linked.palette[1].rgb = ALMOST_RED;
    const reducer = createColourReducer(linked, { cleanup: false });
    expect(reducer.maxColours).toBe(linked.palette.length);
    const same = reduceColours(linked, reducer, reducer.maxColours, linked);
    expect(fingerprint(same)).toBe(fingerprint(linked));
    expect(same.palette.map((c) => c.label).sort()).toEqual(linked.palette.map((c) => c.label).sort());
  });
});
