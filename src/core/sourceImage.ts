import { defaultLabels } from './colourNames';
import { MAX_COLOURS, MAX_HEIGHT, MAX_WIDTH, type Pattern, type Rgb } from './pattern';

export type ImportResult = { ok: true; pattern: Pattern } | { ok: false; error: string };

/**
 * Builds a pattern from the RGBA pixels of a source image: one pixel per bead, exact colours,
 * palette ordered from the most used colour.
 *
 * An image that only fits the limits when turned sideways is accepted so it can be rotated in the Creator.
 */
export function patternFromPixels(width: number, height: number, rgba: ArrayLike<number>, name: string): ImportResult {
  if (width < 1 || height < 1) {
    return { ok: false, error: 'Obraz jest pusty.' };
  }
  const fitsUpright = width <= MAX_WIDTH && height <= MAX_HEIGHT;
  const fitsSideways = height <= MAX_WIDTH && width <= MAX_HEIGHT;
  if (!fitsUpright && !fitsSideways) {
    return {
      ok: false,
      error: `Obraz ma ${width} × ${height} px. Maksymalny rozmiar wzoru to ${MAX_WIDTH} × ${MAX_HEIGHT} px.`,
    };
  }

  const keyToIndex = new Map<number, number>();
  const colours: Rgb[] = [];
  const counts: number[] = [];
  const raw = new Array<number>(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const a = rgba[i * 4 + 3];
    if (a !== 255) {
      const x = i % width;
      const y = Math.floor(i / width);
      return {
        ok: false,
        error: `Obraz zawiera przezroczyste piksele (np. kolumna ${x + 1}, wiersz ${y + 1} od góry). Każdy piksel musi mieć pełny kolor.`,
      };
    }
    const key = (r << 16) | (g << 8) | b;
    let index = keyToIndex.get(key);
    if (index === undefined) {
      index = colours.length;
      keyToIndex.set(key, index);
      colours.push({ r, g, b });
      counts.push(0);
      if (colours.length > MAX_COLOURS) {
        return { ok: false, error: `Obraz ma więcej niż ${MAX_COLOURS} kolorów.` };
      }
    }
    counts[index]++;
    raw[i] = index;
  }

  const order = colours.map((_, i) => i).sort((a, b) => counts[b] - counts[a] || a - b);
  const remap = new Array<number>(order.length);
  order.forEach((oldIndex, newIndex) => (remap[oldIndex] = newIndex));
  const sortedColours = order.map((i) => colours[i]);
  const labels = defaultLabels(sortedColours);

  return {
    ok: true,
    pattern: {
      name,
      width,
      height,
      palette: sortedColours.map((rgb, i) => ({ rgb, label: labels[i] })),
      beads: raw.map((i) => remap[i]),
    },
  };
}
