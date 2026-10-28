export const MAX_WIDTH = 50;
export const MAX_HEIGHT = 500;
export const MAX_COLOURS = 32;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface BeadColour {
  rgb: Rgb;
  label: string;
}

export interface Pattern {
  name: string;
  width: number;
  height: number;
  palette: BeadColour[];
  /** Palette index of every bead, row-major, starting from the top of the source image. */
  beads: number[];
}

export type ReadingDirection = 'ltr' | 'rtl';

export interface Run {
  colour: number;
  count: number;
}

export interface ColourTotal {
  colour: number;
  total: number;
  remaining: number;
}

export function isWithinLimits(pattern: Pattern): boolean {
  return pattern.width <= MAX_WIDTH && pattern.height <= MAX_HEIGHT;
}

/** Beads of a row, left to right. Row 1 is the bottom row. */
export function rowBeads(pattern: Pattern, row: number): number[] {
  const y = pattern.height - row;
  return pattern.beads.slice(y * pattern.width, (y + 1) * pattern.width);
}

export function runs(beads: number[]): Run[] {
  const result: Run[] = [];
  for (const colour of beads) {
    const last = result[result.length - 1];
    if (last && last.colour === colour) {
      last.count++;
    } else {
      result.push({ colour, count: 1 });
    }
  }
  return result;
}

export function rowHint(pattern: Pattern, row: number, direction: ReadingDirection): Run[] {
  const beads = rowBeads(pattern, row);
  if (direction === 'rtl') beads.reverse();
  return runs(beads);
}

/** Per bead colour: beads in the whole pattern and beads in rows not yet done. */
export function colourTotals(pattern: Pattern, progress: number): ColourTotal[] {
  const totals = pattern.palette.map((_, colour) => ({ colour, total: 0, remaining: 0 }));
  const firstRemainingIndex = (pattern.height - progress) * pattern.width;
  pattern.beads.forEach((colour, i) => {
    totals[colour].total++;
    if (i < firstRemainingIndex) totals[colour].remaining++;
  });
  return totals;
}

/** Folds bead colour `from` into `to`; `from` leaves the palette. */
export function mergeColour(pattern: Pattern, from: number, to: number): Pattern {
  if (from === to) return pattern;
  const target = from < to ? to - 1 : to;
  return {
    ...pattern,
    palette: pattern.palette.filter((_, i) => i !== from),
    beads: pattern.beads.map((c) => {
      if (c === from) return target;
      return c > from ? c - 1 : c;
    }),
  };
}

export function rotateClockwise(pattern: Pattern): Pattern {
  const { width, height } = pattern;
  const beads = new Array<number>(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = height - 1 - y;
      const ny = x;
      beads[ny * height + nx] = pattern.beads[y * width + x];
    }
  }
  return { ...pattern, width: height, height: width, beads };
}

export function flipHorizontal(pattern: Pattern): Pattern {
  const { width, height } = pattern;
  const beads = new Array<number>(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      beads[y * width + (width - 1 - x)] = pattern.beads[y * width + x];
    }
  }
  return { ...pattern, beads };
}

export function flipVertical(pattern: Pattern): Pattern {
  const { width, height } = pattern;
  const beads = new Array<number>(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      beads[(height - 1 - y) * width + x] = pattern.beads[y * width + x];
    }
  }
  return { ...pattern, beads };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Relative luminance in 0..1, used to decide when a bead needs an outline or dark text. */
export function luminance({ r, g, b }: Rgb): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
