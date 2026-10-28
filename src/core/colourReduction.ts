import { defaultLabels } from './colourNames';
import { MAX_COLOURS, type Pattern, type Rgb } from './pattern';

/** CIELAB distance below which two shades count as indistinguishable by eye. */
const NEAR_IDENTICAL = 5;
/** Most colours entering pairwise merging; keeps noisy images (thousands of shades) fast. */
const MAX_CANDIDATES = 256;

interface Lab {
  l: number;
  a: number;
  b: number;
}

/** sRGB → CIELAB (D65). */
export function rgbToLab({ r, g, b }: Rgb): Lab {
  const linear = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function squaredDistance(p: Lab, q: Lab): number {
  return (p.l - q.l) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2;
}

export interface ColourReducer {
  minColours: number;
  maxColours: number;
  /** For every palette index of the base pattern, the palette index of the colour it becomes. */
  representatives(target: number): number[];
}

/**
 * Prepares Colour Reduction for a base pattern holding every colour of the source image.
 * The full merge order is computed once, so any colour count can be produced instantly.
 */
export function createColourReducer(base: Pattern, { cleanup = true } = {}): ColourReducer {
  const n = base.palette.length;
  const counts = new Array<number>(n).fill(0);
  for (const c of base.beads) counts[c]++;
  const labs = base.palette.map((c) => rgbToLab(c.rgb));
  const byCount = labs.map((_, i) => i).sort((a, b) => counts[b] - counts[a] || a - b);

  // 1. Fold near-identical shades into the most used one; tighten further if still too many.
  const owner = new Array<number>(n);
  let threshold = cleanup ? NEAR_IDENTICAL : 0;
  let reps: number[];
  for (;;) {
    reps = [];
    for (const i of byCount) {
      const t2 = threshold * threshold;
      const rep = threshold > 0 ? reps.find((r) => squaredDistance(labs[r], labs[i]) < t2) : undefined;
      if (rep === undefined) {
        reps.push(i);
        owner[i] = i;
      } else {
        owner[i] = rep;
      }
    }
    if (reps.length <= MAX_CANDIDATES) break;
    threshold = Math.max(threshold * 1.5, NEAR_IDENTICAL);
  }

  // 2. Merge groups pairwise, cheapest first. Cost grows with colour distance and with how many
  //    beads would change (Ward), so rare stray shades go before large deliberate areas.
  const m = reps.length;
  const groupOf = new Map(reps.map((rep, g) => [rep, g]));
  const groupCounts = new Array<number>(m).fill(0);
  for (let i = 0; i < n; i++) groupCounts[groupOf.get(owner[i])!] += counts[i];
  const d2 = reps.map((p) => reps.map((q) => squaredDistance(labs[p], labs[q])));
  const alive = new Array<boolean>(m).fill(true);
  const merges: [loser: number, winner: number][] = [];

  for (let left = m; left > 1; left--) {
    let best = Infinity;
    let pair: [number, number] = [0, 0];
    for (let i = 0; i < m; i++) {
      if (!alive[i]) continue;
      for (let j = i + 1; j < m; j++) {
        if (!alive[j]) continue;
        const cost = ((groupCounts[i] * groupCounts[j]) / (groupCounts[i] + groupCounts[j])) * d2[i][j];
        if (cost < best) {
          best = cost;
          pair = [i, j];
        }
      }
    }
    const [i, j] = pair;
    const [winner, loser] = groupCounts[i] >= groupCounts[j] ? [i, j] : [j, i];
    merges.push([loser, winner]);
    groupCounts[winner] += groupCounts[loser];
    alive[loser] = false;
  }

  const minColours = Math.min(2, m);
  const maxColours = Math.min(MAX_COLOURS, m);

  return {
    minColours,
    maxColours,
    representatives(target) {
      const t = Math.max(minColours, Math.min(maxColours, Math.round(target)));
      const parent = reps.map((_, g) => g);
      for (let k = 0; k < m - t; k++) {
        const [loser, winner] = merges[k];
        parent[loser] = winner;
      }
      const root = (g: number) => {
        while (parent[g] !== g) g = parent[g];
        return g;
      };
      return owner.map((rep) => reps[root(groupOf.get(rep)!)]);
    },
  };
}

/**
 * The base pattern reduced to `target` colours. Labels of colours that survive are taken from
 * `previous` (matched by exact colour); other colours get default names.
 */
export function reduceColours(base: Pattern, reducer: ColourReducer, target: number, previous?: Pattern): Pattern {
  const representative = reducer.representatives(target);
  const counts = new Map<number, number>();
  for (const c of base.beads) {
    const rep = representative[c];
    counts.set(rep, (counts.get(rep) ?? 0) + 1);
  }
  const kept = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a - b);
  const newIndex = new Map(kept.map((rep, i) => [rep, i]));

  const key = ({ r, g, b }: Rgb) => (r << 16) | (g << 8) | b;
  const previousLabels = new Map(previous?.palette.map((c) => [key(c.rgb), c.label]));
  const carried = kept.map((rep) => previousLabels.get(key(base.palette[rep].rgb)));
  const needDefaults = kept.filter((_, i) => carried[i] === undefined);
  const defaults = defaultLabels(
    needDefaults.map((rep) => base.palette[rep].rgb),
    carried.filter((l): l is string => l !== undefined),
  );

  let nextDefault = 0;
  return {
    name: previous?.name ?? base.name,
    width: base.width,
    height: base.height,
    palette: kept.map((rep, i) => ({
      rgb: base.palette[rep].rgb,
      label: carried[i] ?? defaults[nextDefault++],
    })),
    beads: base.beads.map((c) => newIndex.get(representative[c])!),
  };
}
