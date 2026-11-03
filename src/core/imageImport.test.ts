import { describe, expect, it } from 'vitest';
import {
  adjustScale,
  blockGridSize,
  clampToCrop,
  type Crop,
  defaultScale,
  nudgeCrop,
  patternFromBlocks,
  type Pixels,
} from './imageImport';
import type { Pattern } from './pattern';

type Px = [number, number, number, number?];

function pixels(rows: Px[][]): Pixels {
  const rgba = rows.flat().flatMap(([r, g, b, a = 255]) => [r, g, b, a]);
  return { width: rows[0].length, height: rows.length, rgba };
}

function whole(image: Pixels): Crop {
  return { x: 0, y: 0, width: image.width, height: image.height };
}

function colours(pattern: Pattern) {
  return pattern.beads.map((i) => pattern.palette[i].rgb);
}

const RED: Px = [255, 0, 0];
const GREEN: Px = [0, 255, 0];
const BLUE: Px = [0, 0, 255];
const WHITE: Px = [255, 255, 255];
const rgb = ([r, g, b]: Px) => ({ r, g, b });

describe('patternFromBlocks', () => {
  it('turns each block into one bead', () => {
    const image = pixels([
      [RED, RED, BLUE, BLUE],
      [RED, RED, BLUE, BLUE],
    ]);
    const pattern = patternFromBlocks(image, whole(image), { x: 2, y: 2 }, 'Wzór');
    expect([pattern.width, pattern.height]).toEqual([2, 1]);
    expect(colours(pattern)).toEqual([rgb(RED), rgb(BLUE)]);
  });

  it('samples the middle of fractional blocks, ignoring their edges', () => {
    const image = pixels([[RED, RED, GREEN, BLUE, BLUE]]);
    const pattern = patternFromBlocks(image, whole(image), { x: 2.5, y: 1 }, 'Wzór');
    expect(colours(pattern)).toEqual([rgb(RED), rgb(BLUE)]);
  });

  it('allows different horizontal and vertical scales', () => {
    const image = pixels([
      [RED, RED, BLUE, BLUE],
      [GREEN, GREEN, WHITE, WHITE],
    ]);
    const pattern = patternFromBlocks(image, whole(image), { x: 2, y: 1 }, 'Wzór');
    expect([pattern.width, pattern.height]).toEqual([2, 2]);
    expect(colours(pattern)).toEqual([rgb(RED), rgb(BLUE), rgb(GREEN), rgb(WHITE)]);
  });

  it('leaves out a strip narrower than a full block', () => {
    const image = pixels([[RED, RED, RED, RED, BLUE]]);
    const pattern = patternFromBlocks(image, whole(image), { x: 2, y: 1 }, 'Wzór');
    expect(pattern.width).toBe(2);
    expect(colours(pattern)).toEqual([rgb(RED), rgb(RED)]);
  });

  it('uses the pixel at the centre when the middle of a block is narrower than a pixel', () => {
    const image = pixels([[RED, GREEN, BLUE]]);
    expect(colours(patternFromBlocks(image, whole(image), { x: 1, y: 1 }, 'Wzór'))).toEqual([
      rgb(RED),
      rgb(GREEN),
      rgb(BLUE),
    ]);
    expect(colours(patternFromBlocks(image, whole(image), { x: 1.5, y: 1 }, 'Wzór'))).toEqual([rgb(RED), rgb(BLUE)]);
  });

  it('averages in linear light', () => {
    const image = pixels([[WHITE, RED, GREEN, WHITE]]);
    const pattern = patternFromBlocks(image, whole(image), { x: 4, y: 1 }, 'Wzór');
    expect(colours(pattern)).toEqual([{ r: 188, g: 188, b: 0 }]);
  });

  it('blends transparent pixels onto white', () => {
    const image = pixels([[[0, 0, 0, 0]]]);
    expect(colours(patternFromBlocks(image, whole(image), { x: 1, y: 1 }, 'Wzór'))).toEqual([rgb(WHITE)]);
  });

  it("starts the grid at the crop's top-left corner", () => {
    const image = pixels([[GREEN, RED, RED, BLUE, BLUE]]);
    const pattern = patternFromBlocks(image, { x: 1, y: 0, width: 4, height: 1 }, { x: 2, y: 1 }, 'Wzór');
    expect(colours(pattern)).toEqual([rgb(RED), rgb(BLUE)]);
  });

  it('reads a downscaled copy in original image pixels', () => {
    const half = pixels([[RED, BLUE]]);
    const crop = { x: 0, y: 0, width: 4, height: 2 };
    const pattern = patternFromBlocks(half, crop, { x: 2, y: 2 }, 'Wzór', 0.5);
    expect(colours(pattern)).toEqual([rgb(RED), rgb(BLUE)]);
  });

  it('keeps the name and orders the palette from the most used colour', () => {
    const image = pixels([[RED, BLUE, BLUE]]);
    const pattern = patternFromBlocks(image, whole(image), { x: 1, y: 1 }, 'Bransoletka');
    expect(pattern.name).toBe('Bransoletka');
    expect(pattern.palette.map((c) => c.rgb)).toEqual([rgb(BLUE), rgb(RED)]);
  });
});

describe('scale', () => {
  const crop = { width: 110, height: 670 };

  it('counts whole blocks exactly', () => {
    expect(blockGridSize(crop, { x: 2.2, y: 2.2 })).toEqual({ width: 50, height: 304 });
  });

  it('defaults to the smallest locked scale that fits the limits', () => {
    expect(defaultScale(crop)).toBe(2.2);
    expect(defaultScale({ width: 670, height: 110 })).toBe(2.2);
    expect(defaultScale({ width: 11, height: 67 })).toBe(1);
  });

  it('moves both axes while locked', () => {
    expect(adjustScale({ x: 2, y: 2 }, 'y', 10, true, crop)).toEqual({ x: 10, y: 10 });
  });

  it('moves one axis while unlocked', () => {
    expect(adjustScale({ x: 2, y: 2 }, 'y', 10, false, crop)).toEqual({ x: 2, y: 10 });
  });

  it('rounds to steps of 0.05', () => {
    expect(adjustScale({ x: 2, y: 2 }, 'x', 10.33, true, crop)).toEqual({ x: 10.35, y: 10.35 });
  });

  it('keeps the scale between 1 and one block across the crop', () => {
    expect(adjustScale({ x: 2, y: 2 }, 'x', 0.2, false, crop).x).toBe(1);
    expect(adjustScale({ x: 2, y: 2 }, 'y', 1000, false, crop).y).toBe(670);
    expect(adjustScale({ x: 2, y: 2 }, 'y', 1000, true, crop)).toEqual({ x: 110, y: 110 });
  });

  it('copies the horizontal scale to the vertical one when locking', () => {
    expect(clampToCrop({ x: 3, y: 7 }, true, crop)).toEqual({ x: 3, y: 3 });
  });

  it('shrinks the scale to fit a smaller crop', () => {
    expect(clampToCrop({ x: 50, y: 300 }, false, { width: 40, height: 200 })).toEqual({ x: 40, y: 200 });
  });
});

describe('nudgeCrop', () => {
  const image = { width: 100, height: 50 };

  it('moves a crop inside the image by a pixel', () => {
    expect(nudgeCrop({ x: 10, y: 10, width: 20, height: 20 }, -1, 1, image)).toEqual({
      x: 9,
      y: 11,
      width: 20,
      height: 20,
    });
  });

  it('shrinks the crop at the far image edge', () => {
    expect(nudgeCrop({ x: 0, y: 0, width: 100, height: 50 }, 1, 0, image)).toEqual({
      x: 1,
      y: 0,
      width: 99,
      height: 50,
    });
  });

  it('stays put at the near image edge', () => {
    const crop = { x: 0, y: 0, width: 100, height: 50 };
    expect(nudgeCrop(crop, -1, -1, image)).toEqual(crop);
  });
});
