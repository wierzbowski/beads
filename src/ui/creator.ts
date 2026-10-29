import { decodePattern, encodePattern, PatternLinkError, patternLinkUrl, payloadFromLink } from '../core/codec';
import { type ColourReducer, createColourReducer, reduceColours } from '../core/colourReduction';
import {
  flipHorizontal,
  flipVertical,
  isWithinLimits,
  MAX_HEIGHT,
  MAX_WIDTH,
  mergeColour,
  type Pattern,
  rotateClockwise,
} from '../core/pattern';
import { INITIAL_STATE } from '../core/progress';
import { patternFromPixels } from '../core/sourceImage';
import { confirmDialog, h, toast } from './dom';
import { PatternViewer } from './patternViewer';
import { swatch } from './swatch';

const numberFormat = new Intl.NumberFormat('pl-PL');

export function renderCreator(root: HTMLElement): () => void {
  /** Every colour of the source image, with the same rotation/flip as `pattern`. */
  let base: Pattern | null = null;
  let reducer: ColourReducer | null = null;
  let colourCount = 0;
  let pattern: Pattern | null = null;
  let link: string | null = null;
  let linkRequest = 0;
  let viewer: PatternViewer | null = null;

  document.title = 'Kreator wzoru · Koraliki';

  const fileInput = h('input', { type: 'file', accept: 'image/png,image/*', class: 'visually-hidden', onchange: onFile });
  const linkInput = h('input', { type: 'url', placeholder: 'Wklej link do wzoru…', class: 'input' });
  const loadError = h('p', { class: 'error', hidden: true });
  const editor = h('div', { class: 'editor', hidden: true });

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
        `Wybierz mały obraz (najwyżej ${MAX_WIDTH} × ${MAX_HEIGHT} px) — każdy piksel to jeden koralik.`,
      ),
      h('label', { class: 'btn btn-primary' }, 'Wybierz obraz PNG', fileInput),
      h('p', { class: 'muted or' }, 'albo edytuj istniejący wzór:'),
      h(
        'div',
        { class: 'row' },
        linkInput,
        h('button', { class: 'btn', onclick: onLoadLink }, 'Wczytaj'),
      ),
      loadError,
    ),
    editor,
  );
  root.appendChild(screen);

  function showLoadError(message: string) {
    loadError.textContent = message;
    loadError.hidden = false;
  }

  async function onFile() {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    loadError.hidden = true;
    try {
      const name = file.name.replace(/\.[^.]+$/, '');
      const result = await readSourceImage(file, name);
      if (!result.ok) return showLoadError(result.error);
      startEditing(result.pattern, createColourReducer(result.pattern));
    } catch {
      showLoadError('Nie udało się odczytać obrazu. Spróbuj pliku PNG.');
    }
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
    base = newBase;
    reducer = newReducer;
    colourCount = initial ? initial.palette.length : newReducer.maxColours;
    setPattern(initial ?? reduceColours(newBase, newReducer, colourCount));
  }

  /** Rotation and flips apply to both the base and the edited pattern, so they stay aligned. */
  function transform(fn: (p: Pattern) => Pattern) {
    base = fn(base!);
    setPattern(fn(pattern!));
  }

  function setPattern(next: Pattern) {
    pattern = next;
    link = null;
    renderEditor();
    refreshLink();
  }

  /** Re-renders everything that depends on the bead grid or palette. */
  function renderEditor() {
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

    const viewerBox = h('div', { class: 'preview' });

    editor.replaceChildren(
      h(
        'section',
        { class: 'card' },
        h('label', { class: 'field' }, h('span', {}, 'Nazwa wzoru'), nameInput),
        h(
          'p',
          { class: 'muted' },
          `${p.width} × ${p.height} koralików · ${p.palette.length} ${plural(p.palette.length, 'kolor', 'kolory', 'kolorów')}`,
        ),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn', onclick: () => transform(rotateClockwise) }, 'Obróć ↻'),
          h('button', { class: 'btn', onclick: () => transform(flipHorizontal) }, 'Odbij ↔'),
          h('button', { class: 'btn', onclick: () => transform(flipVertical) }, 'Odbij ↕'),
        ),
        tooWide &&
          h(
            'p',
            { class: 'error' },
            `Wzór może mieć najwyżej ${MAX_WIDTH} koralików szerokości i ${MAX_HEIGHT} wysokości — obróć go.`,
          ),
        viewerBox,
        h('p', { class: 'muted small' }, 'Rząd 1 to dolny rząd obrazu.'),
      ),
      h('section', { class: 'card' }, h('h2', {}, 'Kolory'), colourCountSlider(), paletteList(p)),
      shareCard(tooWide),
    );

    viewer?.destroy();
    viewer = new PatternViewer(viewerBox, p, { fit: 'contain' });
    viewer.setState(null);
    editor.hidden = false;
  }

  /** Colour Reduction control; recalculates from all source colours when released. */
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
      oninput: () => (shown.textContent = slider.value),
      onchange: () => {
        colourCount = Number(slider.value);
        setPattern(reduceColours(base!, reducer!, colourCount, pattern!));
      },
    });
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

  function paletteList(p: Pattern) {
    const counts = p.palette.map(() => 0);
    for (const c of p.beads) counts[c]++;

    return h(
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
              if (!ok) return;
              const merged = mergeColour(current, index, target);
              colourCount = merged.palette.length;
              setPattern(merged);
            },
          },
          h('option', { value: '' }, 'Połącz z…'),
          ...p.palette.map((other, i) => (i === index ? null : h('option', { value: String(i) }, other.label))),
        );
        return h(
          'li',
          {},
          swatch(colour),
          labelInput,
          h('span', { class: 'count' }, `× ${numberFormat.format(counts[index])}`),
          mergeSelect,
        );
      }),
    );
  }

  const linkOutput = h('input', { class: 'input link-output', readOnly: true, onfocus: () => linkOutput.select() });
  const shareButton = h('button', { class: 'btn btn-primary', onclick: onShare }, 'Udostępnij');
  const copyButton = h('button', { class: 'btn', onclick: onCopy }, 'Kopiuj link');
  const previewButton = h('button', { class: 'btn', onclick: () => link && window.open(link, '_blank') }, 'Otwórz podgląd');

  function shareCard(disabled: boolean) {
    for (const b of [shareButton, copyButton, previewButton]) b.disabled = disabled || !link;
    linkOutput.hidden = disabled;
    return h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Udostępnij'),
      h('div', { class: 'row' }, shareButton, copyButton, previewButton),
      linkOutput,
    );
  }

  async function refreshLink() {
    const request = ++linkRequest;
    const p = pattern;
    if (!p || !isWithinLimits(p)) {
      link = null;
      return;
    }
    const payload = await encodePattern(p, INITIAL_STATE);
    if (request !== linkRequest) return;
    link = patternLinkUrl(location.origin + location.pathname, payload);
    linkOutput.value = link;
    for (const b of [shareButton, copyButton, previewButton]) b.disabled = false;
  }

  async function onShare() {
    if (!link || !pattern) return;
    if (!navigator.share) return onCopy();
    try {
      await navigator.share({ title: pattern.name, text: `Wzór: ${pattern.name}`, url: link });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
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

  return () => {
    viewer?.destroy();
    screen.remove();
  };
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
