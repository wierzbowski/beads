import { fitsSomeOrientation, MAX_HEIGHT, MAX_WIDTH, type Pattern } from './pattern';
import { patternFromColourKeys } from './sourceImage';

export interface Size {
  width: number;
  height: number;
}

/** RGBA pixels of a source image, row-major from the top. */
export interface Pixels extends Size {
  rgba: ArrayLike<number>;
}

/** The part of the source image used by Image Import, in whole source image pixels. */
export interface Crop extends Size {
  x: number;
  y: number;
}

/** Width and height of a block, in source image pixels. */
export interface Scale {
  x: number;
  y: number;
}

export type Axis = keyof Scale;

export const MIN_SCALE = 1;
const STEPS_PER_PIXEL = 20;
export const SCALE_STEP = 1 / STEPS_PER_PIXEL;
/** Longer side above which a source image is downscaled on load, to keep memory reasonable on a phone. */
export const MAX_WORKING_SIDE = 4000;

/** Beads across and down; a strip narrower than a full block is left out. */
export function blockGridSize(crop: Size, scale: Scale): Size {
  // The epsilon keeps exact divisions such as 110 / 2.2 from losing a block to rounding.
  return {
    width: Math.floor(crop.width / scale.x + 1e-9),
    height: Math.floor(crop.height / scale.y + 1e-9),
  };
}

/** Largest scale for an axis: one block across the crop. Locked axes share the smaller limit. */
export function maxScale(axis: Axis, locked: boolean, crop: Size): number {
  const side = locked ? Math.min(crop.width, crop.height) : axis === 'x' ? crop.width : crop.height;
  return Math.max(MIN_SCALE, side);
}

function clampScale(value: number, max: number): number {
  const stepped = Math.round(value * STEPS_PER_PIXEL) / STEPS_PER_PIXEL;
  return Math.min(max, Math.max(MIN_SCALE, stepped));
}

/** Sets one axis of the scale, in steps of SCALE_STEP; while locked, both axes take the value. */
export function adjustScale(scale: Scale, axis: Axis, value: number, locked: boolean, crop: Size): Scale {
  const v = clampScale(value, maxScale(axis, locked, crop));
  return locked ? { x: v, y: v } : { ...scale, [axis]: v };
}

/** The scale kept within the limits of a (changed) crop. Locking copies the horizontal scale to the vertical one. */
export function clampToCrop(scale: Scale, locked: boolean, crop: Size): Scale {
  if (locked) return adjustScale(scale, 'x', scale.x, true, crop);
  return {
    x: clampScale(scale.x, maxScale('x', false, crop)),
    y: clampScale(scale.y, maxScale('y', false, crop)),
  };
}

/** The smallest locked scale at which the result fits the limits in some orientation. */
export function defaultScale(crop: Size): number {
  const max = maxScale('x', true, crop);
  // floor(side / s) <= limit exactly when s > side / (limit + 1); start from the looser orientation and step up.
  const upright = Math.max(crop.width / (MAX_WIDTH + 1), crop.height / (MAX_HEIGHT + 1));
  const sideways = Math.max(crop.width / (MAX_HEIGHT + 1), crop.height / (MAX_WIDTH + 1));
  let s = clampScale(Math.min(upright, sideways), max);
  while (s < max && !fitsSomeOrientation(blockGridSize(crop, { x: s, y: s }))) {
    s = clampScale(s + SCALE_STEP, max);
  }
  return s;
}

/** Moves the crop's top-left corner (the grid origin) by whole pixels; at the image edge the crop shrinks instead of leaving it. */
export function nudgeCrop(crop: Crop, dx: number, dy: number, image: Size): Crop {
  const x = Math.min(image.width - 1, Math.max(0, crop.x + dx));
  const y = Math.min(image.height - 1, Math.max(0, crop.y + dy));
  return { x, y, width: Math.min(crop.width, image.width - x), height: Math.min(crop.height, image.height - y) };
}

const LINEAR = Array.from({ length: 256 }, (_, v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

function toSrgb(linear: number): number {
  const c = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(c * 255)));
}

/** A colour channel in linear light, blended onto white when the pixel is not opaque. */
function linearChannel(value: number, alpha: number): number {
  return LINEAR[alpha === 255 ? value : Math.round((value * alpha + 255 * (255 - alpha)) / 255)];
}

interface Sample {
  index: number;
  weight: number;
}

/** Share of a block's side left out at each end when sampling, so edges bleeding from neighbours don't count. */
const SAMPLE_MARGIN = 0.1;

/**
 * The pixels sampled along one axis for a block: its middle 80%, each pixel weighted by how much of it
 * falls inside, or just the pixel at the block's centre when that middle is narrower than a pixel.
 */
function sampleSpan(start: number, size: number, limit: number): Sample[] {
  const centre = { index: Math.min(limit - 1, Math.max(0, Math.floor(start + size / 2))), weight: 1 };
  const from = start + size * SAMPLE_MARGIN;
  const to = start + size * (1 - SAMPLE_MARGIN);
  if (to - from < 1) return [centre];
  const samples: Sample[] = [];
  for (let p = Math.max(0, Math.floor(from)); p < Math.min(limit, to); p++) {
    const weight = Math.min(to, p + 1) - Math.max(from, p);
    if (weight > 0) samples.push({ index: p, weight });
  }
  return samples.length > 0 ? samples : [centre];
}

/**
 * Image Import: builds a base pattern from the blocks of a crop of the source image, each block becoming one
 * bead coloured by the linear-light average of its middle. Crop and scale are in original image pixels;
 * `pixels` may be a downscaled copy holding `ratio` of its pixels per original pixel.
 */
export function patternFromBlocks(pixels: Pixels, crop: Crop, scale: Scale, name: string, ratio = 1): Pattern {
  const { width, height } = blockGridSize(crop, scale);
  const columns = Array.from({ length: width }, (_, i) =>
    sampleSpan((crop.x + i * scale.x) * ratio, scale.x * ratio, pixels.width),
  );
  const rows = Array.from({ length: height }, (_, j) =>
    sampleSpan((crop.y + j * scale.y) * ratio, scale.y * ratio, pixels.height),
  );
  const { rgba } = pixels;
  const keys = new Array<number>(width * height);

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let total = 0;
      for (const row of rows[j]) {
        for (const column of columns[i]) {
          const weight = row.weight * column.weight;
          const at = (row.index * pixels.width + column.index) * 4;
          const alpha = rgba[at + 3];
          r += weight * linearChannel(rgba[at], alpha);
          g += weight * linearChannel(rgba[at + 1], alpha);
          b += weight * linearChannel(rgba[at + 2], alpha);
          total += weight;
        }
      }
      keys[j * width + i] = (toSrgb(r / total) << 16) | (toSrgb(g / total) << 8) | toSrgb(b / total);
    }
  }

  return patternFromColourKeys(width, height, keys, name);
}
