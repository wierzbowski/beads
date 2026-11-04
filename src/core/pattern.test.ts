import { describe, expect, it } from 'vitest';
import {
  colourCounts,
  colourLetter,
  colourTotals,
  flipHorizontal,
  flipVertical,
  mergeColour,
  paintBead,
  patternRgba,
  rotateClockwise,
  rowBeads,
  rowHint,
  runs,
  setColourRgb,
  withoutUnusedColours,
} from './pattern';
import { patternFromRows, rowsOf } from './testPatterns';

const pattern = patternFromRows([
  'RRGGB', // row 3
  'BBBBB', // row 2
  'RRRGB', // row 1
]);

describe('rows', () => {
  it('numbers rows from the bottom', () => {
    expect(rowBeads(pattern, 1).map((c) => pattern.palette[c].label).join('')).toBe('RRRGB');
    expect(rowBeads(pattern, 3).map((c) => pattern.palette[c].label).join('')).toBe('RRGGB');
  });
});

describe('runs and row hint', () => {
  it('groups adjacent beads of the same colour', () => {
    expect(runs([0, 0, 0, 1, 2, 2, 0])).toEqual([
      { colour: 0, count: 3 },
      { colour: 1, count: 1 },
      { colour: 2, count: 2 },
      { colour: 0, count: 1 },
    ]);
  });

  const labelled = (row: number, direction: 'ltr' | 'rtl') =>
    rowHint(pattern, row, direction).map((r) => `${r.count}${pattern.palette[r.colour].label}`);

  it('reads left to right', () => {
    expect(labelled(1, 'ltr')).toEqual(['3R', '1G', '1B']);
  });

  it('reads right to left', () => {
    expect(labelled(1, 'rtl')).toEqual(['1B', '1G', '3R']);
  });

  it('handles a single-colour row', () => {
    expect(labelled(2, 'ltr')).toEqual(['5B']);
  });
});

describe('colour letters', () => {
  it('runs A to Z, then continues with AA', () => {
    expect([0, 1, 25, 26, 27, 31, 51, 52, 701, 702].map(colourLetter)).toEqual([
      'A',
      'B',
      'Z',
      'AA',
      'AB',
      'AF',
      'AZ',
      'BA',
      'ZZ',
      'AAA',
    ]);
  });
});

describe('colour totals', () => {
  it('counts total and remaining beads per colour', () => {
    const [r, g, b] = [0, 1, 2];
    const totals = colourTotals(pattern, 1);
    expect(totals[r]).toEqual({ colour: r, total: 5, remaining: 2 });
    expect(totals[g]).toEqual({ colour: g, total: 3, remaining: 2 });
    expect(totals[b]).toEqual({ colour: b, total: 7, remaining: 6 });
  });

  it('has nothing remaining when complete', () => {
    expect(colourTotals(pattern, 3).every((t) => t.remaining === 0)).toBe(true);
  });
});

describe('merge', () => {
  it('folds one colour into another and drops it from the palette', () => {
    const merged = mergeColour(pattern, 1, 2); // G into B
    expect(merged.palette.map((c) => c.label)).toEqual(['R', 'B']);
    expect(rowsOf(merged)).toEqual(['RRBBB', 'BBBBB', 'RRRBB']);
  });

  it('works when merging into an earlier colour', () => {
    const merged = mergeColour(pattern, 2, 0); // B into R
    expect(merged.palette.map((c) => c.label)).toEqual(['R', 'G']);
    expect(rowsOf(merged)).toEqual(['RRGGR', 'RRRRR', 'RRRGR']);
  });
});

describe('manual edits', () => {
  it('paints a single bead', () => {
    const painted = paintBead(pattern, 0, 2); // top-left R becomes B
    expect(rowsOf(painted)).toEqual(['BRGGB', 'BBBBB', 'RRRGB']);
    expect(rowsOf(pattern)[0]).toBe('RRGGB');
  });

  it('returns the same pattern when the bead already has that colour', () => {
    expect(paintBead(pattern, 0, 0)).toBe(pattern);
  });

  it('changes the exact colour of a bead colour and keeps its label', () => {
    const adjusted = setColourRgb(pattern, 1, { r: 0, g: 128, b: 0 });
    expect(adjusted.palette[1]).toEqual({ rgb: { r: 0, g: 128, b: 0 }, label: 'G' });
    expect(adjusted.beads).toEqual(pattern.beads);
  });

  it('counts beads per colour', () => {
    expect(colourCounts(pattern)).toEqual([5, 3, 7]);
  });

  it('leaves unused colours out, keeping the order of the rest', () => {
    // Paint every G bead red, so G has no beads left.
    const noGreen = [2, 3, 13].reduce((p, i) => paintBead(p, i, 0), pattern);
    const shared = withoutUnusedColours(noGreen);
    expect(shared.palette.map((c) => c.label)).toEqual(['R', 'B']);
    expect(rowsOf(shared)).toEqual(['RRRRB', 'BBBBB', 'RRRRB']);
    expect(withoutUnusedColours(pattern)).toBe(pattern);
  });
});

describe('bitmap', () => {
  it('has one opaque pixel per bead, row-major from the top', () => {
    const rgba = patternRgba(pattern);
    expect(rgba).toHaveLength(5 * 3 * 4);
    pattern.beads.forEach((c, i) => {
      const { r, g, b } = pattern.palette[c].rgb;
      expect([...rgba.subarray(i * 4, i * 4 + 4)]).toEqual([r, g, b, 255]);
    });
  });
});

describe('rotate and flip', () => {
  const small = patternFromRows(['RG', 'BW', 'KR']);

  it('rotates clockwise', () => {
    const rotated = rotateClockwise(small);
    expect([rotated.width, rotated.height]).toEqual([3, 2]);
    expect(rowsOf(rotated)).toEqual(['KBR', 'RWG']);
  });

  it('returns to the original after four rotations', () => {
    let p = small;
    for (let i = 0; i < 4; i++) p = rotateClockwise(p);
    expect(p).toEqual(small);
  });

  it('flips horizontally', () => {
    expect(rowsOf(flipHorizontal(small))).toEqual(['GR', 'WB', 'RK']);
  });

  it('flips vertically', () => {
    expect(rowsOf(flipVertical(small))).toEqual(['KR', 'BW', 'RG']);
  });
});
