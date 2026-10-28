import { luminance, rgbToHex, type BeadColour, type Run } from '../core/pattern';
import { h } from './dom';

export function swatch(colour: BeadColour) {
  return h('span', {
    class: 'swatch' + (luminance(colour.rgb) > 0.85 ? ' swatch-light' : ''),
    style: { backgroundColor: rgbToHex(colour.rgb) },
  });
}

/** One run of a Row Hint: swatch, count and label. */
export function runChip(run: Run, palette: BeadColour[]) {
  const colour = palette[run.colour];
  return h('span', { class: 'chip' }, swatch(colour), h('b', {}, `${run.count}×`), colour.label);
}
