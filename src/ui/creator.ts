import { decodePattern, encodePattern, PatternLinkError, patternLinkUrl, payloadFromLink } from '../core/codec';
import { type ColourReducer, createColourReducer, reduceColours } from '../core/colourReduction';
import {
  colourCounts,
  flipHorizontal,
  flipVertical,
  isWithinLimits,
  MAX_HEIGHT,
  MAX_WIDTH,
  mergeColour,
  paintBead,
  type Pattern,
  patternRgba,
  type Rgb,
  rotateClockwise,
  setColourRgb,
  withoutUnusedColours,
} from '../core/pattern';
import { INITIAL_STATE } from '../core/progress';
import { patternFromPixels } from '../core/sourceImage';
import { adjustColourDialog } from './colourAdjustDialog';
import { confirmDialog, guardControl, h, toast } from './dom';
import { createGalleryAdder } from './galleryAdder';
import { patternShareImage } from './patternThumbnail';
import { PatternViewer } from './patternViewer';
import { readPhoto, ScaleSection } from './scaleSection';
import { swatch } from './swatch';

const numberFormat = new Intl.NumberFormat('pl-PL');

export function renderCreator(root: HTMLElement): () => void {
  /** Every colour of the source image, with the same rotation/flip as `pattern`. */
  let base: Pattern | null = null;
  let reducer: ColourReducer | null = null;
  let colourCount = 0;
  let pattern: Pattern | null = null;
  let link: string | null = null;
  /** The Share Image for `link`, prepared with it so Udostępnij can share straight from the tap (ADR-0007). */
  let shareImage: Promise<File | null> | null = null;
  let linkRequest = 0;
  let viewer: PatternViewer | null = null;
  /** Rotations and flips since the import, re-applied when Image Import rebuilds the base. */
  let transforms: ((p: Pattern) => Pattern)[] = [];
  let scaleSection: ScaleSection | null = null;
  let liveFrame = 0;

  // Manual edits (ADR-0006): merges, colour adjustments and painted beads on top of the last build.
  /** The pattern as last built, which discarding manual edits returns to. */
  let built: Pattern | null = null;
  /** For every palette entry, its colour as last built (for Przywróć); entries leave it with merges. */
  let generated: Rgb[] = [];
  let undoStack: { pattern: Pattern; generated: Rgb[] }[] = [];
  /** Manual edits made before a rotation or flip, which cleared the undo history but kept the edits. */
  let keptEdits = false;
  let selected: number | null = null;
  /** The pattern when a Liczba kolorów drag started, so labels carry over from it rather than from mid-drag. */
  let colourDragStart: Pattern | null = null;

  document.title = 'Kreator wzoru · Koraliki';

  const pixelInput = h('input', { type: 'file', accept: 'image/png,image/*', class: 'visually-hidden', onchange: onPixelFile });
  const imageInput = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', onchange: onImageFile });
  const linkInput = h('input', { type: 'url', placeholder: 'Wklej link do wzoru…', class: 'input' });
  const loadError = h('p', { class: 'error', hidden: true });
  const editor = h('div', { class: 'editor', hidden: true });
  const workspace = h('div', { class: 'workspace' }, editor);
  const viewerBox = h('div', { class: 'preview' });

  const screen = h(
    'div',
    { class: 'creator' },
    h(
      'header',
      { class: 'page-header' },
      h('h1', {}, 'Kreator wzoru'),
      h('a', { class: 'btn', href: import.meta.env.BASE_URL }, 'Galeria'),
    ),
    h(
      'section',
      { class: 'card' },
      h(
        'p',
        { class: 'muted' },
        `Wzór z pikseli: mały obraz PNG (najwyżej ${MAX_WIDTH} × ${MAX_HEIGHT} px), każdy piksel to jeden koralik. ` +
          'Import z obrazka: zdjęcie lub większy obraz, który zmniejszysz suwakiem skali.',
      ),
      h(
        'div',
        { class: 'row' },
        h('label', { class: 'btn btn-primary' }, 'Wzór z pikseli', pixelInput),
        h('label', { class: 'btn btn-primary' }, 'Import z obrazka', imageInput),
      ),
      h('p', { class: 'muted or' }, 'albo edytuj istniejący wzór:'),
      h(
        'div',
        { class: 'row' },
        linkInput,
        h('button', { class: 'btn', onclick: onLoadLink }, 'Wczytaj'),
      ),
      loadError,
    ),
    workspace,
  );
  root.appendChild(screen);

  function showLoadError(message: string) {
    loadError.textContent = message;
    loadError.hidden = false;
  }

  async function onPixelFile() {
    const file = pixelInput.files?.[0];
    pixelInput.value = '';
    if (!file) return;
    loadError.hidden = true;
    try {
      const result = await readSourceImage(file, fileName(file));
      if (!result.ok) return showLoadError(result.error);
      startEditing(result.pattern, createColourReducer(result.pattern));
    } catch {
      showLoadError('Nie udało się odczytać obrazu. Spróbuj pliku PNG.');
    }
  }

  async function onImageFile() {
    const file = imageInput.files?.[0];
    imageInput.value = '';
    if (!file) return;
    loadError.hidden = true;
    try {
      const photo = await readPhoto(file, fileName(file));
      resetSource();
      scaleSection = new ScaleSection(
        photo,
        (done) => (done ? rebuildFromBlocks() : scheduleLivePreview()),
        allowRebuild,
      );
      workspace.prepend(scaleSection.element);
      screen.classList.add('with-photo');
      rebuildFromBlocks(true);
    } catch {
      showLoadError('Nie udało się odczytać obrazu. Spróbuj pliku JPG lub PNG.');
    }
  }

  /** Forgets the previous import, including its photo. */
  function resetSource() {
    cancelAnimationFrame(liveFrame);
    liveFrame = 0;
    scaleSection?.destroy();
    scaleSection = null;
    screen.classList.remove('with-photo');
    transforms = [];
    pattern = null;
  }

  /**
   * Rebuilds the pattern from the photo's blocks after a scale or crop change: Colour Reduction starts over,
   * labels carry over by exact colour, and rotation, flips and the name are kept.
   */
  function rebuildFromBlocks(refit = false) {
    cancelAnimationFrame(liveFrame);
    liveFrame = 0;
    const blocks = scaleSection?.blocks();
    if (!blocks) {
      // Too many beads to be shared even rotated; the Skala section says so.
      editor.hidden = true;
      link = null;
      shareImage = null;
      linkRequest++;
      return;
    }
    const newBase = transforms.reduce((p, fn) => fn(p), blocks);
    base = newBase;
    reducer = createColourReducer(newBase);
    colourCount = reducer.maxColours;
    build(reduceColours(newBase, reducer, colourCount, pattern ?? undefined), { refit });
  }

  /** While dragging, previews the blocks in their exact colours; Colour Reduction waits for the release. */
  function scheduleLivePreview() {
    if (liveFrame) return;
    liveFrame = requestAnimationFrame(() => {
      liveFrame = 0;
      const blocks = scaleSection?.blocks();
      if (blocks && viewer && !editor.hidden) viewer.setPattern(transforms.reduce((p, fn) => fn(p), blocks), true);
    });
  }

  async function onLoadLink() {
    loadError.hidden = true;
    const payload = payloadFromLink(linkInput.value.trim());
    if (!payload) return showLoadError('To nie wygląda na link do wzoru.');
    try {
      const decoded = await decodePattern(payload);
      linkInput.value = '';
      // No automatic cleanup, so the shared pattern opens unchanged.
      startEditing(decoded.pattern, createColourReducer(decoded.pattern, { cleanup: false }), decoded.pattern);
    } catch (e) {
      showLoadError(e instanceof PatternLinkError ? e.message : 'Nie udało się wczytać wzoru.');
    }
  }

  function startEditing(newBase: Pattern, newReducer: ColourReducer, initial?: Pattern) {
    resetSource();
    base = newBase;
    reducer = newReducer;
    colourCount = initial ? initial.palette.length : newReducer.maxColours;
    build(initial ?? reduceColours(newBase, newReducer, colourCount), { refit: true });
  }

  /** Rotation and flips apply to both the base and the edited pattern, so they stay aligned. Manual edits stay. */
  function transform(fn: (p: Pattern) => Pattern) {
    transforms.push(fn);
    base = fn(base!);
    built = fn(built!);
    keptEdits = hasEdits();
    undoStack = [];
    setPattern(fn(pattern!), { refit: true });
  }

  /** A freshly built pattern: manual edits, undo history and selection start over (ADR-0006). */
  function build(next: Pattern, { refit = false } = {}) {
    built = next;
    generated = next.palette.map((c) => c.rgb);
    undoStack = [];
    keptEdits = false;
    selected = null;
    setPattern(next, { refit });
  }

  function hasEdits() {
    return undoStack.length > 0 || keptEdits;
  }

  /** Applies a manual edit, remembering the pattern before it for Cofnij. */
  function edit(next: Pattern, nextGenerated = generated) {
    undoStack.push({ pattern: pattern!, generated });
    generated = nextGenerated;
    setPattern(next);
  }

  /** Label edits aren't manual edits, so a restored palette keeps today's labels, matched by built colour. */
  function withCurrentLabels(target: Pattern, targetGenerated: Rgb[]): Pattern {
    const labels = new Map(generated.map((rgb, i) => [rgbKey(rgb), pattern!.palette[i].label]));
    return {
      ...target,
      name: pattern!.name,
      palette: target.palette.map((c, i) => ({ ...c, label: labels.get(rgbKey(targetGenerated[i])) ?? c.label })),
    };
  }

  function undo() {
    const last = undoStack.pop();
    if (!last || !pattern) return;
    const selectedKey = selected === null ? null : rgbKey(generated[selected]);
    const restored = withCurrentLabels(last.pattern, last.generated);
    generated = last.generated;
    const index = generated.findIndex((rgb) => rgbKey(rgb) === selectedKey);
    selected = index >= 0 ? index : null;
    colourCount = restored.palette.length;
    setPattern(restored);
  }

  /**
   * Lets a control that rebuilds the pattern go ahead when there are no manual edits. Otherwise it asks; on yes
   * the edits are discarded (back to the last build) and the user repeats the change.
   */
  function allowRebuild(): boolean {
    if (!hasEdits()) return true;
    void confirmDialog('Zmiana usunie ręczne poprawki. Kontynuować?', 'Kontynuuj').then((ok) => {
      if (!ok || !built || !pattern) return;
      colourCount = built.palette.length;
      build(withCurrentLabels(built, built.palette.map((c) => c.rgb)));
    });
    return false;
  }

  /** `refit` fits the preview to the new pattern; otherwise its zoom and pan are kept. */
  function setPattern(next: Pattern, { refit = false } = {}) {
    pattern = next;
    link = null;
    shareImage = null;
    renderEditor(refit);
    refreshLink();
  }

  function select(index: number | null) {
    selected = index;
    paletteItems.forEach((li, i) => li.classList.toggle('selected', i === selected));
    if (viewer) viewer.element.style.cursor = selected === null ? '' : 'crosshair';
  }

  function onBeadTap(index: number) {
    if (selected === null || !pattern) return;
    const painted = paintBead(pattern, index, selected);
    if (painted !== pattern) edit(painted);
  }

  async function openAdjust(index: number) {
    if (!pattern) return;
    const result = await adjustColourDialog({
      colour: pattern.palette[index],
      generated: generated[index],
      onPreview: (rgb) => viewer?.setPattern(rgb ? setColourRgb(pattern!, index, rgb) : pattern!, true),
      findMatch: (rgb) => pattern!.palette.findIndex((c, i) => i !== index && rgbKey(c.rgb) === rgbKey(rgb)),
      labelOf: (i) => pattern!.palette[i].label,
    });
    if (!result) return;
    if (result.kind === 'merge') return merge(index, result.into);
    if (rgbKey(result.rgb) !== rgbKey(pattern.palette[index].rgb)) edit(setColourRgb(pattern, index, result.rgb));
  }

  /** Folds bead colour `from` into `to` as a manual edit; a selected `from` is deselected. */
  function merge(from: number, to: number) {
    const merged = mergeColour(pattern!, from, to);
    if (selected === from) selected = null;
    else if (selected !== null && selected > from) selected--;
    colourCount = merged.palette.length;
    edit(
      merged,
      generated.filter((_, i) => i !== from),
    );
  }

  const paletteBox = h('div');
  const summary = h('p', { class: 'muted' });
  let paletteItems: HTMLLIElement[] = [];

  /** Re-renders everything that depends on the bead grid or palette. */
  function renderEditor(refit: boolean) {
    if (!pattern) return;
    const p = pattern;
    const tooWide = !isWithinLimits(p);

    const nameInput = h('input', {
      class: 'input',
      value: p.name,
      placeholder: 'np. Bransoletka w paski',
      oninput: () => {
        pattern = { ...pattern!, name: nameInput.value };
        refreshLink();
      },
    });

    editor.replaceChildren(
      h(
        'section',
        { class: 'card' },
        h('label', { class: 'field' }, h('span', {}, 'Nazwa wzoru'), nameInput),
        summary,
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn', onclick: () => transform(rotateClockwise) }, 'Obróć ↻'),
          h('button', { class: 'btn', onclick: () => transform(flipHorizontal) }, 'Odbij ↔'),
          h('button', { class: 'btn', onclick: () => transform(flipVertical) }, 'Odbij ↕'),
          h(
            'button',
            { class: 'btn', disabled: undoStack.length === 0, title: 'Cofnij ręczną poprawkę (Ctrl+Z)', onclick: undo },
            'Cofnij ↶',
          ),
        ),
        tooWide &&
          h(
            'p',
            { class: 'error' },
            `Wzór może mieć najwyżej ${MAX_WIDTH} koralików szerokości i ${MAX_HEIGHT} wysokości — obróć go.`,
          ),
        viewerBox,
        h(
          'p',
          { class: 'muted small' },
          'Rząd 1 to dolny rząd obrazu. Wybierz kolor na liście, by poprawiać pojedyncze koraliki kliknięciem.',
        ),
      ),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, 'Kolory'),
        colourCountSlider(),
        h('p', { class: 'muted small' }, 'Kliknij wybrany kolor jeszcze raz, by zmienić jego odcień.'),
        paletteBox,
      ),
      shareCard(tooWide),
    );
    renderPalette();

    editor.hidden = false;
    if (viewer) {
      viewer.setPattern(p, !refit);
    } else {
      viewer = new PatternViewer(viewerBox, p, { fit: 'contain', onBeadTap });
      viewer.setState(null);
    }
    select(selected);
  }

  /** The size and colour count line, and the palette list; also redrawn live while Liczba kolorów is dragged. */
  function renderPalette() {
    const p = pattern!;
    summary.textContent = `${p.width} × ${p.height} koralików · ${p.palette.length} ${plural(p.palette.length, 'kolor', 'kolory', 'kolorów')}`;
    paletteBox.replaceChildren(paletteList(p));
    select(selected);
  }

  /** Colour Reduction control; the preview and palette follow while dragging, and the pattern is rebuilt on release. */
  function colourCountSlider() {
    if (!base || !reducer || reducer.maxColours <= reducer.minColours) return null;
    const shown = h('b', {}, String(colourCount));
    const slider = h('input', {
      type: 'range',
      class: 'slider',
      min: String(reducer.minColours),
      max: String(reducer.maxColours),
      step: '1',
      value: String(colourCount),
      oninput: () => {
        shown.textContent = slider.value;
        colourDragStart ??= pattern;
        scheduleColourPreview(Number(slider.value));
      },
      onchange: () => {
        cancelAnimationFrame(liveFrame);
        liveFrame = 0;
        const previous = colourDragStart ?? pattern!;
        colourDragStart = null;
        colourCount = Number(slider.value);
        build(reduceColours(base!, reducer!, colourCount, previous));
      },
    });
    guardControl(slider, allowRebuild);
    const shades = base.palette.length;
    return h(
      'div',
      { class: 'slider-field' },
      h('label', {}, 'Liczba kolorów: ', shown, slider),
      shades > reducer.maxColours &&
        h(
          'p',
          { class: 'muted small' },
          `Obraz ma ${numberFormat.format(shades)} ${plural(shades, 'odcień', 'odcienie', 'odcieni')} — podobne zostały połączone.`,
        ),
    );
  }

  /** While Liczba kolorów is dragged, reduces at most once per frame and shows it without a rebuild. */
  function scheduleColourPreview(count: number) {
    cancelAnimationFrame(liveFrame);
    liveFrame = requestAnimationFrame(() => {
      liveFrame = 0;
      if (!base || !reducer) return;
      pattern = reduceColours(base, reducer, count, colourDragStart ?? pattern!);
      // Indices change with the colour count, so a selection would point at another colour.
      selected = null;
      renderPalette();
      viewer?.setPattern(pattern, true);
      refreshLink();
    });
  }

  function paletteList(p: Pattern) {
    const counts = colourCounts(p);

    const list = h(
      'ul',
      { class: 'palette' },
      ...p.palette.map((colour, index) => {
        const labelInput = h('input', {
          class: 'input',
          value: colour.label,
          oninput: () => {
            const palette = pattern!.palette.map((c, i) => (i === index ? { ...c, label: labelInput.value } : c));
            pattern = { ...pattern!, palette };
            refreshLink();
          },
        });
        const mergeSelect = h(
          'select',
          {
            class: 'input merge',
            disabled: p.palette.length < 2,
            onchange: async () => {
              const target = Number(mergeSelect.value);
              mergeSelect.value = '';
              const current = pattern!;
              const ok = await confirmDialog(
                `Połączyć kolor „${current.palette[index].label}” z „${current.palette[target].label}”? ` +
                  `Wszystkie jego koraliki zmienią kolor.`,
                'Połącz',
              );
              if (ok) merge(index, target);
            },
          },
          h('option', { value: '' }, 'Połącz z…'),
          ...p.palette.map((other, i) => (i === index ? null : h('option', { value: String(i) }, other.label))),
        );
        return h(
          'li',
          {
            class: counts[index] === 0 ? 'unused' : '',
            onclick: (e: MouseEvent) => {
              const target = e.target as HTMLElement;
              // Typing a label or picking a merge never changes the selection.
              if (target.closest('input, select')) return;
              if (selected !== index) select(index);
              else if (target.closest('.swatch')) openAdjust(index);
              else select(null);
            },
          },
          swatch(colour),
          labelInput,
          h('span', { class: 'count' }, `× ${numberFormat.format(counts[index])}`),
          mergeSelect,
        );
      }),
    );
    paletteItems = [...list.children] as HTMLLIElement[];
    return list;
  }

  const linkOutput = h('input', { class: 'input link-output', readOnly: true, onfocus: () => linkOutput.select() });
  const shareButton = h('button', { class: 'btn btn-primary', onclick: onShare }, 'Udostępnij');
  const copyButton = h('button', { class: 'btn', onclick: onCopy }, 'Kopiuj link');
  const pngButton = h('button', { class: 'btn', onclick: onDownloadPng }, 'Pobierz PNG');
  // Writes src/gallery.ts through the dev server, so it only exists under `pnpm dev` (ADR-0005).
  const galleryAdder = import.meta.env.DEV ? createGalleryAdder() : null;

  function shareCard(disabled: boolean) {
    for (const b of [shareButton, copyButton]) b.disabled = disabled || !link;
    // The bitmap needs no link, so it is available even while the pattern is over the link limits.
    pngButton.disabled = !pattern;
    if (disabled) galleryAdder?.setLink(null, null);
    linkOutput.hidden = disabled;
    return h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Udostępnij'),
      h('div', { class: 'row' }, shareButton, copyButton, pngButton, galleryAdder?.button),
      linkOutput,
      galleryAdder?.panel,
    );
  }

  async function refreshLink() {
    const request = ++linkRequest;
    const p = pattern;
    if (!p || !isWithinLimits(p)) {
      link = null;
      shareImage = null;
      galleryAdder?.setLink(null, null);
      return;
    }
    // Colours painted down to zero beads stay in the list while editing but not in the link.
    const payload = await encodePattern(withoutUnusedColours(p), INITIAL_STATE);
    if (request !== linkRequest) return;
    link = patternLinkUrl(location.origin + location.pathname, payload);
    shareImage = shareImageFile(p);
    linkOutput.value = link;
    for (const b of [shareButton, copyButton]) b.disabled = false;
    galleryAdder?.setLink(p, payload);
  }

  async function onShare() {
    if (!link || !pattern) return;
    if (!navigator.share) return onCopy();
    const [url, title, image] = [link, pattern.name, shareImage];
    const text = `Wzór: ${title}`;
    const file = await image;
    // With a file attached, apps often drop `url`, so the link goes in the text (ADR-0007).
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        return await navigator.share({ title, text: `${text}\n${url}`, files: [file] });
      } catch (e) {
        if (isAbort(e)) return;
      }
    }
    try {
      await navigator.share({ title, text, url });
    } catch (e) {
      if (isAbort(e)) return;
      onCopy();
    }
  }

  async function onCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast('Skopiowano link');
    } catch {
      linkOutput.focus();
      toast('Skopiuj link z pola poniżej');
    }
  }

  /** Downloads the pattern as shown, one pixel per bead. */
  function onDownloadPng() {
    if (!pattern) return;
    const { width, height } = pattern;
    const canvas = h('canvas', { width, height });
    canvas.getContext('2d')!.putImageData(new ImageData(patternRgba(pattern), width, height), 0, 0);
    const name = pngFileName(pattern);
    canvas.toBlob((blob) => {
      if (!blob) return toast('Nie udało się utworzyć obrazu');
      const url = URL.createObjectURL(blob);
      h('a', { href: url, download: name }).click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }, 'image/png');
  }

  /** Esc deselects; Ctrl+Z undoes a manual edit unless a text field has focus. Dialogs handle their own keys. */
  function onKeyDown(e: KeyboardEvent) {
    if (editor.hidden || document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape' && selected !== null) {
      select(null);
    } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !isTextField(e.target)) {
      e.preventDefault();
      undo();
    }
  }
  document.addEventListener('keydown', onKeyDown);

  return () => {
    document.removeEventListener('keydown', onKeyDown);
    resetSource();
    viewer?.destroy();
    screen.remove();
  };
}

function rgbKey({ r, g, b }: Rgb): number {
  return (r << 16) | (g << 8) | b;
}

function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type !== 'range');
}

function fileName(file: File): string {
  return file.name.replace(/\.[^.]+$/, '');
}

/** The pattern name without characters file systems reject, for Pobierz PNG and the Share Image. */
function pngFileName(pattern: Pattern): string {
  return `${pattern.name.replace(/[\\/:*?"<>|]/g, '').trim() || 'wzor'}.png`;
}

function shareImageFile(pattern: Pattern): Promise<File | null> {
  return new Promise((resolve) => {
    patternShareImage(pattern).toBlob((blob) => {
      resolve(blob && new File([blob], pngFileName(pattern), { type: 'image/png' }));
    }, 'image/png');
  });
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

async function readSourceImage(file: File, name: string) {
  const bitmap = await createImageBitmap(file, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const { width, height } = bitmap;
  // Oversized images (e.g. photos) are rejected by size alone, without reading their pixels.
  if (width > MAX_HEIGHT || height > MAX_HEIGHT) {
    bitmap.close();
    return patternFromPixels(width, height, [], name);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return patternFromPixels(width, height, ctx.getImageData(0, 0, width, height).data, name);
}

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
}
