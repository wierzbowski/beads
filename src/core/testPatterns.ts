import type { Pattern } from './pattern';

const COLOURS: Record<string, { r: number; g: number; b: number }> = {
  R: { r: 255, g: 0, b: 0 },
  G: { r: 0, g: 255, b: 0 },
  B: { r: 0, g: 0, b: 255 },
  W: { r: 255, g: 255, b: 255 },
  K: { r: 0, g: 0, b: 0 },
};

/** Builds a pattern from rows of letters written top to bottom, as in the source image. */
export function patternFromRows(rows: string[], name = 'Test'): Pattern {
  const letters = [...new Set(rows.join(''))];
  return {
    name,
    width: rows[0].length,
    height: rows.length,
    palette: letters.map((l) => ({ rgb: COLOURS[l], label: l })),
    beads: rows.join('').split('').map((l) => letters.indexOf(l)),
  };
}

/** The pattern drawn back as rows of letters (using labels), top to bottom. */
export function rowsOf(pattern: Pattern): string[] {
  const rows: string[] = [];
  for (let y = 0; y < pattern.height; y++) {
    rows.push(
      pattern.beads
        .slice(y * pattern.width, (y + 1) * pattern.width)
        .map((c) => pattern.palette[c].label)
        .join(''),
    );
  }
  return rows;
}
