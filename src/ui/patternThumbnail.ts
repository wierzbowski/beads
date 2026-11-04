import { luminance, rgbToHex, type Pattern } from '../core/pattern';
import { BEAD_H, BEAD_W, CELL_H, CELL_W, GAP, LIGHT_OUTLINE } from './patternViewer';

// Canvas pixels the thumbnail may use; CSS scales it down to fit its box, keeping the aspect ratio.
const MAX_PX_W = 400;
const MAX_PX_H = 360;
const MAX_SCALE = 2;
// Below this bead size in pixels, rounded corners and gaps are invisible, so beads are drawn as plain cells.
const MIN_DETAILED_BEAD_PX = 4;

// Share Image size (ADR-0007): the longest side aims for this, but the shorter side never goes below its minimum.
const SHARE_LONG_PX = 1600;
const SHARE_MIN_SHORT_PX = 200;
// The app background (--bg in style.css); a shared PNG needs an opaque one.
const SHARE_BACKGROUND = '#f4f3f1';

/** Static, non-interactive drawing of a whole pattern, for Gallery tiles. */
export function patternThumbnail(pattern: Pattern): HTMLCanvasElement {
  const scale = Math.min(MAX_PX_W / (pattern.width * CELL_W), MAX_PX_H / (pattern.height * CELL_H), MAX_SCALE);
  const canvas = drawPattern(pattern, scale);
  canvas.className = 'thumbnail';
  return canvas;
}

/** The Share Image: the whole pattern drawn like a Gallery tile, large enough for a chat photo. */
export function patternShareImage(pattern: Pattern): HTMLCanvasElement {
  const contentW = pattern.width * CELL_W;
  const contentH = pattern.height * CELL_H;
  const scale = Math.max(SHARE_LONG_PX / Math.max(contentW, contentH), SHARE_MIN_SHORT_PX / Math.min(contentW, contentH));
  return drawPattern(pattern, scale, SHARE_BACKGROUND);
}

function drawPattern(pattern: Pattern, scale: number, background?: string): HTMLCanvasElement {
  const contentW = pattern.width * CELL_W;
  const contentH = pattern.height * CELL_H;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(contentW * scale));
  canvas.height = Math.max(1, Math.round(contentH * scale));
  const ctx = canvas.getContext('2d')!;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.scale(canvas.width / contentW, canvas.height / contentH);

  const colours = pattern.palette.map((c) => rgbToHex(c.rgb));
  const lightColours = pattern.palette.map((c) => luminance(c.rgb) > 0.85);
  const detailed = BEAD_W * scale >= MIN_DETAILED_BEAD_PX;

  // Row 1 is the bottom row, and the bead grid is stored from the top image row, so drawing top-down matches.
  for (let y = 0; y < pattern.height; y++) {
    for (let x = 0; x < pattern.width; x++) {
      const colour = pattern.beads[y * pattern.width + x];
      ctx.fillStyle = colours[colour];
      if (!detailed) {
        ctx.fillRect(x * CELL_W, y * CELL_H, CELL_W, CELL_H);
        continue;
      }
      ctx.beginPath();
      ctx.roundRect(x * CELL_W + GAP / 2, y * CELL_H + GAP / 2, BEAD_W, BEAD_H, 2.5);
      ctx.fill();
      if (lightColours[colour]) {
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = LIGHT_OUTLINE;
        ctx.stroke();
      }
    }
  }
  return canvas;
}
