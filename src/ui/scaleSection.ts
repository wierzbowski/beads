import {
  adjustScale,
  type Axis,
  blockGridSize,
  clampToCrop,
  type Crop,
  defaultScale,
  MAX_WORKING_SIDE,
  maxScale,
  MIN_SCALE,
  nudgeCrop,
  patternFromBlocks,
  type Pixels,
  type Scale,
  SCALE_STEP,
} from '../core/imageImport';
import { fitsSomeOrientation, MAX_HEIGHT, MAX_WIDTH, type Pattern } from '../core/pattern';
import { CropView } from './cropView';
import { h } from './dom';

/** Slider positions; the slider is logarithmic so small scales stay precise on a large photo. */
const SLIDER_STEPS = 1000;

/** A source image loaded for Image Import. Sizes are in original pixels; `pixels` may be a downscaled copy. */
export interface Photo {
  name: string;
  width: number;
  height: number;
  bitmap: ImageBitmap;
  pixels: Pixels;
  /** Pixels of `pixels` per original pixel; below 1 when downscaled on load. */
  ratio: number;
}

export async function readPhoto(file: File, name: string): Promise<Photo> {
  const full = await createImageBitmap(file, { premultiplyAlpha: 'none' });
  const { width, height } = full;
  const ratio = Math.min(1, MAX_WORKING_SIDE / Math.max(width, height));
  let bitmap = full;
  if (ratio < 1) {
    bitmap = await createImageBitmap(full, {
      premultiplyAlpha: 'none',
      resizeWidth: Math.max(1, Math.round(width * ratio)),
      resizeHeight: Math.max(1, Math.round(height * ratio)),
      resizeQuality: 'high',
    });
    full.close();
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return {
    name,
    width,
    height,
    bitmap,
    pixels: { width: bitmap.width, height: bitmap.height, rgba: data },
    ratio: bitmap.width / width,
  };
}

function sliderToScale(position: number, max: number): number {
  return Math.exp((position / SLIDER_STEPS) * Math.log(max));
}

function scaleToSlider(scale: number, max: number): number {
  return max > MIN_SCALE ? Math.round((Math.log(scale) / Math.log(max)) * SLIDER_STEPS) : 0;
}

const formatScale = (s: number) => String(Math.round(s * 100) / 100);

/**
 * The Skala section of Image Import: the photo view with crop and block grid, the X/Y scale controls and
 * nudge buttons. Reports every change; `done` is false while a slider or the crop is still being dragged.
 */
export class ScaleSection {
  readonly element: HTMLElement;
  private crop: Crop;
  private scale: Scale;
  private locked = true;
  private readonly cropView: CropView;
  private readonly sizeReadout = h('p', { class: 'scale-size' });
  private readonly lockButton: HTMLButtonElement;
  private readonly controls: Record<Axis, { slider: HTMLInputElement; number: HTMLInputElement; element: HTMLElement }>;

  constructor(
    private readonly photo: Photo,
    private readonly onChange: (done: boolean) => void,
  ) {
    this.crop = { x: 0, y: 0, width: photo.width, height: photo.height };
    const s = defaultScale(this.crop);
    this.scale = { x: s, y: s };

    const photoBox = h('div', { class: 'photo-view' });
    this.controls = { x: this.scaleControl('x'), y: this.scaleControl('y') };
    this.lockButton = h('button', { class: 'btn lock', onclick: () => this.toggleLock() }, '🔗');
    const nudge = (label: string, symbol: string, dx: number, dy: number) =>
      h('button', { class: 'btn', title: label, ariaLabel: label, onclick: () => this.nudge(dx, dy) }, symbol);

    this.element = h(
      'section',
      { class: 'card scale-card' },
      h('h2', {}, 'Skala'),
      photoBox,
      h(
        'p',
        { class: 'muted small' },
        'Przeciągnij kadr lub jego krawędzie, by ułożyć siatkę na koralikach. ' +
          'Dwa palce lub prawy przycisk myszy przesuwają widok.',
      ),
      h('div', { class: 'scale-controls' }, this.controls.x.element, this.lockButton, this.controls.y.element),
      this.sizeReadout,
      h(
        'div',
        { class: 'row nudge' },
        h('span', { class: 'muted small' }, 'Przesuń siatkę o 1 px:'),
        nudge('W lewo', '←', -1, 0),
        nudge('W prawo', '→', 1, 0),
        nudge('W górę', '↑', 0, -1),
        nudge('W dół', '↓', 0, 1),
      ),
    );

    this.cropView = new CropView(photoBox, photo.bitmap, photo.width, photo.height, this.crop, this.scale, (crop, done) => {
      this.crop = crop;
      this.scale = clampToCrop(this.scale, this.locked, crop);
      this.sync();
      this.onChange(done);
    });
    this.sync();
  }

  destroy() {
    this.cropView.destroy();
    this.photo.bitmap.close();
    this.element.remove();
  }

  /** The base pattern for the current crop and scale, or null while it would not fit the limits even rotated. */
  blocks(): Pattern | null {
    if (!fitsSomeOrientation(blockGridSize(this.crop, this.scale))) return null;
    return patternFromBlocks(this.photo.pixels, this.crop, this.scale, this.photo.name, this.photo.ratio);
  }

  private scaleControl(axis: Axis) {
    const slider = h('input', {
      type: 'range',
      class: 'slider',
      min: '0',
      max: String(SLIDER_STEPS),
      step: '1',
      ariaLabel: axis === 'x' ? 'Skala w poziomie' : 'Skala w pionie',
      oninput: () => this.setScale(axis, sliderToScale(Number(slider.value), this.maxScale(axis)), false, slider),
      onchange: () => this.onChange(true),
    });
    const number = h('input', {
      type: 'number',
      class: 'input scale-number',
      min: String(MIN_SCALE),
      step: String(SCALE_STEP),
      inputMode: 'decimal',
      onchange: () => {
        const value = Number(number.value);
        if (number.value !== '' && Number.isFinite(value)) this.setScale(axis, value, true);
        else this.sync();
      },
    });
    const element = h(
      'div',
      { class: 'scale-axis' },
      h('label', {}, axis === 'x' ? 'Poziomo 1 :' : 'Pionowo 1 :', number),
      slider,
    );
    return { slider, number, element };
  }

  private maxScale(axis: Axis) {
    return maxScale(axis, this.locked, this.crop);
  }

  private setScale(axis: Axis, value: number, done: boolean, source?: HTMLInputElement) {
    this.scale = adjustScale(this.scale, axis, value, this.locked, this.crop);
    this.sync(source);
    this.onChange(done);
  }

  private toggleLock() {
    this.locked = !this.locked;
    const before = this.scale;
    this.scale = clampToCrop(this.scale, this.locked, this.crop);
    this.sync();
    if (this.scale.x !== before.x || this.scale.y !== before.y) this.onChange(true);
  }

  private nudge(dx: number, dy: number) {
    const image = { width: this.photo.width, height: this.photo.height };
    this.crop = nudgeCrop(this.crop, dx, dy, image);
    this.scale = clampToCrop(this.scale, this.locked, this.crop);
    this.sync();
    this.onChange(true);
  }

  /** Brings every control in line with the crop and scale, except the slider being dragged. */
  private sync(except?: HTMLInputElement) {
    for (const axis of ['x', 'y'] as const) {
      const { slider, number } = this.controls[axis];
      const max = this.maxScale(axis);
      slider.disabled = max <= MIN_SCALE;
      if (slider !== except) slider.value = String(scaleToSlider(this.scale[axis], max));
      number.max = String(max);
      number.value = formatScale(this.scale[axis]);
    }
    this.lockButton.classList.toggle('locked', this.locked);
    this.lockButton.setAttribute('aria-pressed', String(this.locked));
    this.lockButton.title = this.locked ? 'Skale połączone — kliknij, by rozdzielić' : 'Skale rozdzielone — kliknij, by połączyć';

    const size = blockGridSize(this.crop, this.scale);
    const fits = fitsSomeOrientation(size);
    this.sizeReadout.textContent = fits
      ? `${size.width} × ${size.height} koralików`
      : `${size.width} × ${size.height} koralików — za dużo (najwyżej ${MAX_WIDTH} × ${MAX_HEIGHT}), zwiększ skalę`;
    this.sizeReadout.classList.toggle('error', !fits);
    this.cropView.setGrid(this.crop, this.scale);
  }
}
