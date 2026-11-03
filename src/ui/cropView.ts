import { blockGridSize, type Crop, type Scale } from '../core/imageImport';

const BACKGROUND = '#e9e8e5';
const OUTSIDE = 'rgb(0 0 0 / 0.5)';
const LEFTOVER = 'rgb(255 255 255 / 0.6)';
const FRAME = '#0f766e';
const HANDLE_PX = 12;
const HANDLE_HIT_PX = 22;
/** Most screen pixels per image pixel when zoomed in. */
const MAX_PIXEL_PX = 40;
/** Grid lines are drawn once blocks are at least this big on screen. */
const MIN_GRID_PX = 4;

interface Point {
  x: number;
  y: number;
}

interface Edges {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

type Drag = { kind: 'pan' } | { kind: 'move' | 'resize'; edges: Edges; start: Point; crop: Crop; moved: boolean };

/**
 * Canvas view of a source image with the crop and its block grid drawn over it. Handles resize the crop,
 * dragging inside moves it, dragging outside (or with two fingers or the right mouse button) pans, and
 * pinch or wheel zooms. World units are original image pixels.
 */
export class CropView {
  readonly element: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;

  private viewW = 0;
  private viewH = 0;
  private zoom = 1;
  private tx = 0;
  private ty = 0;
  private needsInitialFit = true;
  private frame = 0;

  private pointers = new Map<number, Point>();
  private drag: Drag | null = null;
  private pinch: { distance: number; mid: Point; zoom: number; tx: number; ty: number } | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly image: CanvasImageSource,
    private readonly imageW: number,
    private readonly imageH: number,
    private crop: Crop,
    private scale: Scale,
    private readonly onChange: (crop: Crop, done: boolean) => void,
  ) {
    this.element = document.createElement('canvas');
    this.element.className = 'viewer-canvas';
    this.ctx = this.element.getContext('2d')!;
    container.appendChild(this.element);

    this.element.addEventListener('pointerdown', this.onPointerDown);
    this.element.addEventListener('pointermove', this.onPointerMove);
    this.element.addEventListener('pointerup', this.onPointerEnd);
    this.element.addEventListener('pointercancel', this.onPointerEnd);
    this.element.addEventListener('wheel', this.onWheel, { passive: false });
    this.element.addEventListener('contextmenu', (e) => e.preventDefault());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
  }

  destroy() {
    this.resizeObserver.disconnect();
    cancelAnimationFrame(this.frame);
    this.element.remove();
  }

  setGrid(crop: Crop, scale: Scale) {
    this.crop = crop;
    this.scale = scale;
    this.requestDraw();
  }

  private get fitZoom() {
    return Math.min(this.viewW / this.imageW, this.viewH / this.imageH);
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
      this.zoom = this.fitZoom;
    }
    this.clampView();
    this.requestDraw();
  }

  private clampView() {
    const clampAxis = (t: number, size: number, view: number) =>
      size <= view ? (view - size) / 2 : Math.min(0, Math.max(view - size, t));
    this.tx = clampAxis(this.tx, this.imageW * this.zoom, this.viewW);
    this.ty = clampAxis(this.ty, this.imageH * this.zoom, this.viewH);
  }

  private zoomAround(point: Point, newZoom: number, from = { zoom: this.zoom, tx: this.tx, ty: this.ty }) {
    const fit = this.fitZoom;
    const zoom = Math.min(Math.max(MAX_PIXEL_PX, fit), Math.max(fit * 0.5, newZoom));
    const worldX = (point.x - from.tx) / from.zoom;
    const worldY = (point.y - from.ty) / from.zoom;
    this.zoom = zoom;
    this.tx = point.x - worldX * zoom;
    this.ty = point.y - worldY * zoom;
    this.clampView();
    this.requestDraw();
  }

  private localPoint(e: PointerEvent | WheelEvent): Point {
    const rect = this.element.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private toImage(p: Point): Point {
    return { x: (p.x - this.tx) / this.zoom, y: (p.y - this.ty) / this.zoom };
  }

  private pinchInfo() {
    const [a, b] = [...this.pointers.values()];
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

  /** What a single-pointer drag starting at `p` does. */
  private dragAt(p: Point, button: number): Drag {
    if (button !== 0) return { kind: 'pan' };
    const crop = { ...this.crop };
    const left = this.tx + crop.x * this.zoom;
    const right = left + crop.width * this.zoom;
    const top = this.ty + crop.y * this.zoom;
    const bottom = top + crop.height * this.zoom;
    const withinX = p.x >= left - HANDLE_HIT_PX && p.x <= right + HANDLE_HIT_PX;
    const withinY = p.y >= top - HANDLE_HIT_PX && p.y <= bottom + HANDLE_HIT_PX;
    // On a small crop both opposite edges are in reach; take the nearer one.
    const [dl, dr, dt, db] = [Math.abs(p.x - left), Math.abs(p.x - right), Math.abs(p.y - top), Math.abs(p.y - bottom)];
    const edges = {
      left: withinY && dl <= HANDLE_HIT_PX && dl <= dr,
      right: withinY && dr <= HANDLE_HIT_PX && dr < dl,
      top: withinX && dt <= HANDLE_HIT_PX && dt <= db,
      bottom: withinX && db <= HANDLE_HIT_PX && db < dt,
    };
    const start = this.toImage(p);
    if (edges.left || edges.right || edges.top || edges.bottom) {
      return { kind: 'resize', edges, start, crop, moved: false };
    }
    const inside = p.x > left && p.x < right && p.y > top && p.y < bottom;
    // A crop covering the whole image cannot move, so dragging inside it pans instead.
    const coversImage = crop.width === this.imageW && crop.height === this.imageH;
    if (inside && !coversImage) return { kind: 'move', edges, start, crop, moved: false };
    return { kind: 'pan' };
  }

  private dragCrop(drag: Extract<Drag, { kind: 'move' | 'resize' }>, p: Point) {
    const at = this.toImage(p);
    const dx = Math.round(at.x - drag.start.x);
    const dy = Math.round(at.y - drag.start.y);
    const c = drag.crop;
    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    let next: Crop;
    if (drag.kind === 'move') {
      next = {
        ...c,
        x: clamp(c.x + dx, 0, this.imageW - c.width),
        y: clamp(c.y + dy, 0, this.imageH - c.height),
      };
    } else {
      let [l, r, t, b] = [c.x, c.x + c.width, c.y, c.y + c.height];
      if (drag.edges.left) l = clamp(l + dx, 0, r - 1);
      if (drag.edges.right) r = clamp(r + dx, l + 1, this.imageW);
      if (drag.edges.top) t = clamp(t + dy, 0, b - 1);
      if (drag.edges.bottom) b = clamp(b + dy, t + 1, this.imageH);
      next = { x: l, y: t, width: r - l, height: b - t };
    }
    const { x, y, width, height } = this.crop;
    if (next.x === x && next.y === y && next.width === width && next.height === height) return;
    drag.moved = true;
    this.crop = next;
    this.requestDraw();
    this.onChange(next, false);
  }

  private endDrag() {
    const drag = this.drag;
    this.drag = null;
    if (drag && drag.kind !== 'pan' && drag.moved) this.onChange(this.crop, true);
  }

  private onPointerDown = (e: PointerEvent) => {
    this.element.setPointerCapture(e.pointerId);
    const p = this.localPoint(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.drag = this.dragAt(p, e.button);
    } else {
      this.endDrag();
      if (this.pointers.size === 2) {
        this.pinch = { ...this.pinchInfo(), zoom: this.zoom, tx: this.tx, ty: this.ty };
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
      this.zoomAround(start.mid, start.zoom * (distance / start.distance), start);
      // Follow the fingers' midpoint as it moves.
      this.tx += mid.x - start.mid.x;
      this.ty += mid.y - start.mid.y;
      this.clampView();
      return;
    }

    if (!this.drag) return;
    if (this.drag.kind === 'pan') {
      this.tx += p.x - last.x;
      this.ty += p.y - last.y;
      this.clampView();
      this.requestDraw();
    } else {
      this.dragCrop(this.drag, p);
    }
  };

  private onPointerEnd = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0) this.endDrag();
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoomAround(this.localPoint(e), this.zoom * Math.exp(-e.deltaY * 0.0015));
  };

  private requestDraw() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private draw() {
    const { ctx, zoom, crop, scale, imageW, imageH } = this;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, this.element.width, this.element.height);

    // Image and shading in image pixels. Pixels stay sharp when zoomed in, to help line the grid up.
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * this.tx, dpr * this.ty);
    ctx.imageSmoothingEnabled = zoom < 2;
    ctx.drawImage(this.image, 0, 0, imageW, imageH);

    const right = crop.x + crop.width;
    const bottom = crop.y + crop.height;
    ctx.fillStyle = OUTSIDE;
    ctx.fillRect(0, 0, imageW, crop.y);
    ctx.fillRect(0, bottom, imageW, imageH - bottom);
    ctx.fillRect(0, crop.y, crop.x, crop.height);
    ctx.fillRect(right, crop.y, imageW - right, crop.height);

    const grid = blockGridSize(crop, scale);
    const gridRight = crop.x + grid.width * scale.x;
    const gridBottom = crop.y + grid.height * scale.y;
    ctx.fillStyle = LEFTOVER;
    ctx.fillRect(gridRight, crop.y, right - gridRight, crop.height);
    ctx.fillRect(crop.x, gridBottom, gridRight - crop.x, bottom - gridBottom);

    // Lines and handles in screen pixels, so they stay thin and the same size at any zoom.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = (x: number) => this.tx + x * zoom;
    const sy = (y: number) => this.ty + y * zoom;

    if (scale.x * zoom >= MIN_GRID_PX && scale.y * zoom >= MIN_GRID_PX) {
      ctx.beginPath();
      for (let i = 1; i <= grid.width; i++) {
        const x = Math.round(sx(crop.x + i * scale.x)) + 0.5;
        if (x < 0 || x > this.viewW) continue;
        ctx.moveTo(x, sy(crop.y));
        ctx.lineTo(x, sy(gridBottom));
      }
      for (let j = 1; j <= grid.height; j++) {
        const y = Math.round(sy(crop.y + j * scale.y)) + 0.5;
        if (y < 0 || y > this.viewH) continue;
        ctx.moveTo(sx(crop.x), y);
        ctx.lineTo(sx(gridRight), y);
      }
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgb(0 0 0 / 0.25)';
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgb(255 255 255 / 0.85)';
      ctx.stroke();
    }

    const [left, top, w, h] = [sx(crop.x), sy(crop.y), crop.width * zoom, crop.height * zoom];
    ctx.lineWidth = 2;
    ctx.strokeStyle = FRAME;
    ctx.strokeRect(left, top, w, h);

    ctx.fillStyle = '#ffffff';
    for (const fx of [0, 0.5, 1]) {
      for (const fy of [0, 0.5, 1]) {
        if (fx === 0.5 && fy === 0.5) continue;
        const hx = left + fx * w - HANDLE_PX / 2;
        const hy = top + fy * h - HANDLE_PX / 2;
        ctx.fillRect(hx, hy, HANDLE_PX, HANDLE_PX);
        ctx.strokeRect(hx, hy, HANDLE_PX, HANDLE_PX);
      }
    }
  }
}
