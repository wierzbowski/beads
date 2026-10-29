import { luminance, rgbToHex, type Pattern } from '../core/pattern';
import { BEAD_H, BEAD_W, CELL_H, CELL_W, GAP, LIGHT_OUTLINE } from './patternViewer';

// Canvas pixels the thumbnail may use; CSS scales it down to fit its box, keeping the aspect ratio.
const MAX_PX_W = 400;
const MAX_PX_H = 360;
const MAX_SCALE = 2;
// Below this bead size in pixels, rounded corners and gaps are invisible, so beads are drawn as plain cells.
const MIN_DETAILED_BEAD_PX = 4;

/** Static, non-interactive drawing of a whole pattern, for Gallery tiles. */
export function patternThumbnail(pattern: Pattern): HTMLCanvasElement {
  const contentW = pattern.width * CELL_W;
  const contentH = pattern.height * CELL_H;
  const scale = Math.min(MAX_PX_W / contentW, MAX_PX_H / contentH, MAX_SCALE);

  const canvas = document.createElement('canvas');
  canvas.className = 'thumbnail';
  canvas.width = Math.max(1, Math.round(contentW * scale));
  canvas.height = Math.max(1, Math.round(contentH * scale));
  const ctx = canvas.getContext('2d')!;
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
