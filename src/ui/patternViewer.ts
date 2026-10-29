import { luminance, rgbToHex, type Pattern } from '../core/pattern';
import type { CraftState } from '../core/progress';

// World units; beads are slightly taller than wide, like Delicas on a loom.
export const BEAD_W = 10;
export const BEAD_H = 12;
export const GAP = 1.5;
export const CELL_W = BEAD_W + GAP;
export const CELL_H = BEAD_H + GAP;
const LABEL_W = 26;
const ARROW_W = 14;
const PAD = 8;

const BACKGROUND = '#e9e8e5';
const TEXT = '#55524c';
const CURRENT = '#1f2937';
export const LIGHT_OUTLINE = '#a8a39a';
const MAX_FIT_BEAD_PX = 40;
const TAP_SLOP = 8;
const TAP_MAX_MS = 500;

export interface ViewerOptions {
  /** 'width' fills the width and scrolls vertically; 'contain' shows the whole pattern. */
  fit: 'width' | 'contain';
  onRowTap?: (row: number) => void;
}

interface Point {
  x: number;
  y: number;
}

/** Canvas view of a pattern with its own pinch-zoom and drag-to-pan. */
export class PatternViewer {
  readonly element: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private pattern: Pattern;
  private colours: string[] = [];
  private lightColours: boolean[] = [];
  private state: CraftState | null = null;

  private viewW = 0;
  private viewH = 0;
  private scale = 1;
  private tx = 0;
  private ty = 0;
  private needsInitialFit = true;
  private frame = 0;

  private pointers = new Map<number, Point>();
  private tap: (Point & { time: number }) | null = null;
  private pinch: { distance: number; mid: Point; scale: number; tx: number; ty: number } | null = null;

  constructor(
    private readonly container: HTMLElement,
    pattern: Pattern,
    private readonly options: ViewerOptions,
  ) {
    this.pattern = pattern;
    this.updateColours();
    this.element = document.createElement('canvas');
    this.element.className = 'viewer-canvas';
    this.ctx = this.element.getContext('2d')!;
    container.appendChild(this.element);

    this.element.addEventListener('pointerdown', this.onPointerDown);
    this.element.addEventListener('pointermove', this.onPointerMove);
    this.element.addEventListener('pointerup', this.onPointerUp);
    this.element.addEventListener('pointercancel', this.onPointerCancel);
    this.element.addEventListener('wheel', this.onWheel, { passive: false });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
  }

  destroy() {
    this.resizeObserver.disconnect();
    cancelAnimationFrame(this.frame);
    this.element.remove();
  }

  setPattern(pattern: Pattern) {
    this.pattern = pattern;
    this.updateColours();
    this.needsInitialFit = true;
    this.resize();
  }

  /** Progress styling; null draws the pattern plainly (Creator preview). */
  setState(state: CraftState | null) {
    const rowChanged = this.state?.progress !== state?.progress;
    this.state = state;
    if (rowChanged && !this.needsInitialFit) this.keepCurrentRowVisible();
    this.requestDraw();
  }

  private updateColours() {
    this.colours = this.pattern.palette.map((c) => rgbToHex(c.rgb));
    this.lightColours = this.pattern.palette.map((c) => luminance(c.rgb) > 0.85);
  }

  private get contentW() {
    return LABEL_W + this.pattern.width * CELL_W + ARROW_W;
  }

  private get contentH() {
    return PAD * 2 + this.pattern.height * CELL_H;
  }

  private rowTop(row: number) {
    return PAD + (this.pattern.height - row) * CELL_H;
  }

  private fitScale(mode: 'width' | 'contain') {
    // On wide screens filling the width would make beads huge; cap them at a comfortable size.
    const widthScale = Math.min(this.viewW / this.contentW, MAX_FIT_BEAD_PX / CELL_W);
    return mode === 'width' ? widthScale : Math.min(widthScale, this.viewH / this.contentH);
  }

  private get minScale() {
    return this.fitScale('contain') * 0.8;
  }

  private get maxScale() {
    return Math.max(80 / CELL_W, this.fitScale('width'));
  }

  private resize() {
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    this.viewW = rect.width;
    this.viewH = rect.height;
    this.element.width = Math.round(rect.width * dpr);
    this.element.height = Math.round(rect.height * dpr);
    this.element.style.width = `${rect.width}px`;
    this.element.style.height = `${rect.height}px`;

    if (this.needsInitialFit) {
      this.needsInitialFit = false;
      this.scale = this.fitScale(this.options.fit);
      this.tx = 0;
      this.ty = 0;
      this.clampView();
      if (this.state) this.centreOnCurrentRow();
    } else {
      this.clampView();
    }
    this.requestDraw();
  }

  private currentRow(): number | null {
    if (!this.state || this.state.progress >= this.pattern.height) return null;
    return this.state.progress + 1;
  }

  private centreOnCurrentRow() {
    const row = this.currentRow() ?? this.pattern.height;
    this.ty = this.viewH / 2 - (this.rowTop(row) + CELL_H / 2) * this.scale;
    this.clampView();
  }

  private keepCurrentRowVisible() {
    const row = this.currentRow();
    if (row === null) return;
    const top = this.rowTop(row) * this.scale + this.ty;
    const bottom = top + CELL_H * this.scale;
    if (top < this.viewH * 0.2 || bottom > this.viewH * 0.8) this.centreOnCurrentRow();
  }

  private clampView() {
    const clampAxis = (t: number, size: number, view: number) =>
      size <= view ? (view - size) / 2 : Math.min(0, Math.max(view - size, t));
    this.tx = clampAxis(this.tx, this.contentW * this.scale, this.viewW);
    this.ty = clampAxis(this.ty, this.contentH * this.scale, this.viewH);
  }

  private zoomAround(point: Point, newScale: number, from = { scale: this.scale, tx: this.tx, ty: this.ty }) {
    const scale = Math.min(this.maxScale, Math.max(this.minScale, newScale));
    const worldX = (point.x - from.tx) / from.scale;
    const worldY = (point.y - from.ty) / from.scale;
    this.scale = scale;
    this.tx = point.x - worldX * scale;
    this.ty = point.y - worldY * scale;
    this.clampView();
    this.requestDraw();
  }

  private localPoint(e: PointerEvent | WheelEvent): Point {
    const rect = this.element.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private pinchInfo() {
    const [a, b] = [...this.pointers.values()];
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

  private onPointerDown = (e: PointerEvent) => {
    this.element.setPointerCapture(e.pointerId);
    const p = this.localPoint(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.tap = { ...p, time: performance.now() };
    } else {
      this.tap = null;
      if (this.pointers.size === 2) {
        this.pinch = { ...this.pinchInfo(), scale: this.scale, tx: this.tx, ty: this.ty };
      }
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const last = this.pointers.get(e.pointerId);
    if (!last) return;
    const p = this.localPoint(e);
    this.pointers.set(e.pointerId, p);

    if (this.pinch && this.pointers.size >= 2) {
      const { distance, mid } = this.pinchInfo();
      const start = this.pinch;
      this.zoomAround(start.mid, start.scale * (distance / start.distance), start);
      // Follow the fingers' midpoint as it moves.
      this.tx += mid.x - start.mid.x;
      this.ty += mid.y - start.mid.y;
      this.clampView();
      return;
    }

    if (this.tap && Math.hypot(p.x - this.tap.x, p.y - this.tap.y) > TAP_SLOP) this.tap = null;
    if (!this.tap) {
      this.tx += p.x - last.x;
      this.ty += p.y - last.y;
      this.clampView();
      this.requestDraw();
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const tap = this.tap;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    this.tap = null;
    if (tap && performance.now() - tap.time < TAP_MAX_MS) this.handleTap(tap);
  };

  private onPointerCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    this.tap = null;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoomAround(this.localPoint(e), this.scale * Math.exp(-e.deltaY * 0.0015));
  };

  private handleTap(p: Point) {
    if (!this.options.onRowTap) return;
    const worldX = (p.x - this.tx) / this.scale;
    const worldY = (p.y - this.ty) / this.scale;
    if (worldX < 0 || worldX > this.contentW) return;
    const rowIndexFromTop = Math.floor((worldY - PAD) / CELL_H);
    if (rowIndexFromTop < 0 || rowIndexFromTop >= this.pattern.height) return;
    this.options.onRowTap(this.pattern.height - rowIndexFromTop);
  }

  private requestDraw() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private draw() {
    const { ctx, pattern, scale } = this;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, this.element.width, this.element.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * this.tx, dpr * this.ty);

    const progress = this.state?.progress ?? 0;
    const current = this.currentRow();
    const visibleTop = -this.ty / scale;
    const visibleBottom = visibleTop + this.viewH / scale;
    const showEveryLabel = CELL_H * scale >= 11;

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let row = 1; row <= pattern.height; row++) {
      const top = this.rowTop(row);
      if (top + CELL_H < visibleTop || top > visibleBottom) continue;
      const done = this.state !== null && row <= progress;
      const isCurrent = row === current;

      if (showEveryLabel || row % 5 === 0 || row === 1 || isCurrent) {
        ctx.fillStyle = isCurrent ? CURRENT : TEXT;
        ctx.font = `${isCurrent ? 'bold ' : ''}7px system-ui, sans-serif`;
        ctx.fillText(String(row), LABEL_W - 5, top + CELL_H / 2);
      }

      ctx.globalAlpha = done ? 0.28 : 1;
      const y = top + GAP / 2;
      const offset = (pattern.height - row) * pattern.width;
      for (let x = 0; x < pattern.width; x++) {
        const colour = pattern.beads[offset + x];
        const bx = LABEL_W + x * CELL_W + GAP / 2;
        ctx.beginPath();
        ctx.roundRect(bx, y, BEAD_W, BEAD_H, 2.5);
        ctx.fillStyle = this.colours[colour];
        ctx.fill();
        if (this.lightColours[colour]) {
          ctx.lineWidth = 0.6;
          ctx.strokeStyle = LIGHT_OUTLINE;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      if (isCurrent) this.drawCurrentRow(top);
    }
  }

  private drawCurrentRow(top: number) {
    const { ctx } = this;
    const left = LABEL_W - 1;
    const right = LABEL_W + this.pattern.width * CELL_W + 1;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = CURRENT;
    ctx.beginPath();
    ctx.roundRect(left, top - 0.5, right - left, CELL_H + 1, 3);
    ctx.stroke();

    // Reading direction arrow beside the row.
    const cy = top + CELL_H / 2;
    const ax = right + 3;
    ctx.fillStyle = CURRENT;
    ctx.beginPath();
    if (this.state?.direction === 'rtl') {
      ctx.moveTo(ax, cy);
      ctx.lineTo(ax + 8, cy - 5);
      ctx.lineTo(ax + 8, cy + 5);
    } else {
      ctx.moveTo(ax + 8, cy);
      ctx.lineTo(ax, cy - 5);
      ctx.lineTo(ax, cy + 5);
    }
    ctx.closePath();
    ctx.fill();
  }
}
