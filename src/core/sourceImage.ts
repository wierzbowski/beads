import { fitsSomeOrientation, MAX_HEIGHT, MAX_WIDTH, type Pattern, type Rgb } from './pattern';

export type ImportResult = { ok: true; pattern: Pattern } | { ok: false; error: string };

/**
 * Pixel Import: builds a base pattern from the RGBA pixels of a source image, one pixel per bead.
 *
 * An image that only fits the limits when turned sideways is accepted so it can be rotated in the Creator.
 */
export function patternFromPixels(width: number, height: number, rgba: ArrayLike<number>, name: string): ImportResult {
  if (width < 1 || height < 1) {
    return { ok: false, error: 'Obraz jest pusty.' };
  }
  if (!fitsSomeOrientation({ width, height })) {
    return {
      ok: false,
      error: `Obraz ma ${width} × ${height} px. Maksymalny rozmiar wzoru to ${MAX_WIDTH} × ${MAX_HEIGHT} px.`,
    };
  }

  const keys = new Array<number>(width * height);
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
    keys[i] = (r << 16) | (g << 8) | b;
  }

  return { ok: true, pattern: patternFromColourKeys(width, height, keys, name) };
}

/**
 * Builds a base pattern from the colour of every bead (as 0xRRGGBB, row-major from the top): every exact
 * colour kept (unlabelled), palette ordered from the most used colour. Colour Reduction turns it into a
 * shareable pattern.
 */
export function patternFromColourKeys(width: number, height: number, keys: ArrayLike<number>, name: string): Pattern {
  const keyToIndex = new Map<number, number>();
  const colours: Rgb[] = [];
  const counts: number[] = [];
  const raw = new Array<number>(keys.length);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    let index = keyToIndex.get(key);
    if (index === undefined) {
      index = colours.length;
      keyToIndex.set(key, index);
      colours.push({ r: key >> 16, g: (key >> 8) & 255, b: key & 255 });
      counts.push(0);
    }
    counts[index]++;
    raw[i] = index;
  }

  const order = colours.map((_, i) => i).sort((a, b) => counts[b] - counts[a] || a - b);
  const remap = new Array<number>(order.length);
  order.forEach((oldIndex, newIndex) => (remap[oldIndex] = newIndex));

  return {
    name,
    width,
    height,
    palette: order.map((i) => ({ rgb: colours[i], label: '' })),
    beads: raw.map((i) => remap[i]),
  };
}
