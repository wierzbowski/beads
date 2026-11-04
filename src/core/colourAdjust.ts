import { type Lab, rgbToLab } from './colourReduction';
import type { Rgb } from './pattern';

/**
 * Colour Adjustment works in CIE LCh (CIELAB in polar form), the perceptual space Colour Reduction uses,
 * so changing lightness doesn't shift the hue and changing the hue keeps the lightness.
 */
export interface Lch {
  /** Lightness, 0 (black) to 100 (white). */
  l: number;
  /** Chroma (saturation), 0 for greys. */
  c: number;
  /** Hue angle in degrees, 0 to 360. */
  h: number;
}

export const MAX_CHROMA = 150;

export function rgbToLch(rgb: Rgb): Lch {
  const { l, a, b } = rgbToLab(rgb);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
}

/** Linear-light sRGB channels of a CIELAB colour (D65); outside 0..1 when out of the sRGB gamut. */
function labToLinear({ l, a, b }: Lab): [number, number, number] {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inverse = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const x = inverse(fx) * 0.95047;
  const y = inverse(fy);
  const z = inverse(fz) * 1.08883;
  return [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
}

function lchToLab({ l, c, h }: Lch): Lab {
  const angle = (h * Math.PI) / 180;
  return { l, a: c * Math.cos(angle), b: c * Math.sin(angle) };
}

const inGamut = (channels: number[]) => channels.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/**
 * The sRGB colour for an LCh colour. A colour outside what a screen can show keeps its lightness and hue
 * and loses just enough chroma to fit.
 */
export function lchToRgb(lch: Lch): Rgb {
  const l = Math.min(100, Math.max(0, lch.l));
  let channels = labToLinear(lchToLab({ ...lch, l }));
  if (!inGamut(channels)) {
    let low = 0;
    let high = Math.max(0, lch.c);
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (inGamut(labToLinear(lchToLab({ l, c: mid, h: lch.h })))) low = mid;
      else high = mid;
    }
    channels = labToLinear(lchToLab({ l, c: low, h: lch.h }));
  }
  const encode = (v: number) => {
    const c = Math.min(1, Math.max(0, v));
    const s = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(s * 255);
  };
  const [r, g, b] = channels.map(encode);
  return { r, g, b };
}
