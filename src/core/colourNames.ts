import type { Rgb } from './pattern';

const NAMED_COLOURS: [string, Rgb][] = [
  ['czarny', { r: 0, g: 0, b: 0 }],
  ['ciemnoszary', { r: 80, g: 80, b: 80 }],
  ['szary', { r: 128, g: 128, b: 128 }],
  ['jasnoszary', { r: 200, g: 200, b: 200 }],
  ['biały', { r: 255, g: 255, b: 255 }],
  ['kremowy', { r: 255, g: 248, b: 220 }],
  ['beżowy', { r: 222, g: 196, b: 160 }],
  ['brązowy', { r: 120, g: 70, b: 30 }],
  ['ciemnobrązowy', { r: 70, g: 40, b: 20 }],
  ['bordowy', { r: 120, g: 20, b: 40 }],
  ['ciemnoczerwony', { r: 160, g: 0, b: 0 }],
  ['czerwony', { r: 220, g: 20, b: 30 }],
  ['malinowy', { r: 210, g: 30, b: 90 }],
  ['różowy', { r: 255, g: 150, b: 190 }],
  ['jasnoróżowy', { r: 255, g: 205, b: 220 }],
  ['łososiowy', { r: 250, g: 128, b: 114 }],
  ['pomarańczowy', { r: 255, g: 140, b: 0 }],
  ['złoty', { r: 212, g: 175, b: 55 }],
  ['żółty', { r: 255, g: 220, b: 0 }],
  ['jasnożółty', { r: 255, g: 245, b: 150 }],
  ['oliwkowy', { r: 128, g: 128, b: 0 }],
  ['jasnozielony', { r: 140, g: 220, b: 100 }],
  ['zielony', { r: 30, g: 150, b: 50 }],
  ['ciemnozielony', { r: 0, g: 80, b: 30 }],
  ['miętowy', { r: 170, g: 240, b: 200 }],
  ['turkusowy', { r: 30, g: 190, b: 180 }],
  ['błękitny', { r: 135, g: 200, b: 245 }],
  ['niebieski', { r: 30, g: 90, b: 220 }],
  ['granatowy', { r: 20, g: 30, b: 100 }],
  ['fioletowy', { r: 130, g: 50, b: 170 }],
  ['liliowy', { r: 200, g: 160, b: 220 }],
];

/** "Redmean" approximation of perceived colour distance. */
function distance(a: Rgb, b: Rgb): number {
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
}

export function nearestColourName(rgb: Rgb): string {
  let best = NAMED_COLOURS[0];
  let bestDistance = Infinity;
  for (const named of NAMED_COLOURS) {
    const d = distance(rgb, named[1]);
    if (d < bestDistance) {
      best = named;
      bestDistance = d;
    }
  }
  return best[0];
}

/**
 * Nearest colour names, numbered when several colours share a name ("niebieski", "niebieski 2").
 * Labels in `taken` are already in use and won't be repeated.
 */
export function defaultLabels(colours: Rgb[], taken: string[] = []): string[] {
  const used = new Set(taken);
  return colours.map((rgb) => {
    const name = nearestColourName(rgb);
    let label = name;
    for (let n = 2; used.has(label); n++) label = `${name} ${n}`;
    used.add(label);
    return label;
  });
}
