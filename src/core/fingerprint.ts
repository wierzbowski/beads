import type { Pattern } from './pattern';

/**
 * Identifies the Same Pattern: depends only on dimensions and the exact colour of every bead,
 * so labels, name, palette order, progress and direction don't change it.
 */
export function fingerprint(pattern: Pattern): string {
  // cyrb53
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const feed = (n: number) => {
    h1 = Math.imul(h1 ^ n, 2654435761);
    h2 = Math.imul(h2 ^ n, 1597334677);
  };

  feed(pattern.width);
  feed(pattern.height);
  for (const colour of pattern.beads) {
    const { r, g, b } = pattern.palette[colour].rgb;
    feed((r << 16) | (g << 8) | b);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}
