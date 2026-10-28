import { describe, expect, it } from 'vitest';
import { fingerprint } from './fingerprint';
import { mergeColour, rotateClockwise } from './pattern';
import { patternFromRows } from './testPatterns';

const pattern = patternFromRows(['RRGGB', 'BBBBB', 'RRRGB']);

describe('fingerprint (Same Pattern)', () => {
  it('is stable', () => {
    expect(fingerprint(pattern)).toBe(fingerprint(structuredClone(pattern)));
    expect(fingerprint(pattern)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('ignores name and labels', () => {
    const renamed = structuredClone(pattern);
    renamed.name = 'Inna nazwa';
    renamed.palette[0].label = 'DB-0010';
    expect(fingerprint(renamed)).toBe(fingerprint(pattern));
  });

  it('ignores palette order', () => {
    const reordered = structuredClone(pattern);
    reordered.palette.reverse();
    const last = pattern.palette.length - 1;
    reordered.beads = pattern.beads.map((c) => last - c);
    expect(fingerprint(reordered)).toBe(fingerprint(pattern));
  });

  it('changes when a bead changes', () => {
    const changed = structuredClone(pattern);
    changed.beads[0] = 2;
    expect(fingerprint(changed)).not.toBe(fingerprint(pattern));
  });

  it('changes when an exact colour changes', () => {
    const recoloured = structuredClone(pattern);
    recoloured.palette[0].rgb = { r: 254, g: 0, b: 0 };
    expect(fingerprint(recoloured)).not.toBe(fingerprint(pattern));
  });

  it('changes after merge or rotation', () => {
    expect(fingerprint(mergeColour(pattern, 1, 2))).not.toBe(fingerprint(pattern));
    expect(fingerprint(rotateClockwise(pattern))).not.toBe(fingerprint(pattern));
  });

  it('distinguishes dimensions with the same beads', () => {
    const tall = patternFromRows(['RG', 'BR']);
    const wide = patternFromRows(['RGBR']);
    expect(fingerprint(tall)).not.toBe(fingerprint(wide));
  });
});
