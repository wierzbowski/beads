import { decodePattern } from '../core/codec';
import { fingerprint } from '../core/fingerprint';
import { compareNames, matchesName } from '../core/nameSearch';
import type { Pattern } from '../core/pattern';
import { localStateStore } from '../core/progress';
import { galleryPatterns } from '../gallery';
import { h } from './dom';
import { patternThumbnail } from './patternThumbnail';

interface GalleryEntry {
  /** The Gallery's name for the pattern, which may differ from the name inside the payload. */
  name: string;
  payload: string;
  pattern: Pattern;
}

type SortOrder = 'gallery' | 'name';

/** Kept across visits, so going Back from a pattern keeps the search and order. */
let lastQuery = '';
let lastOrder: SortOrder = 'gallery';

export function renderGallery(root: HTMLElement): () => void {
  let active = true;
  document.title = 'Galeria · Koraliki';

  const search = h('input', {
    type: 'search',
    class: 'input gallery-search',
    placeholder: 'Szukaj po nazwie…',
    ariaLabel: 'Szukaj po nazwie',
    value: lastQuery,
    oninput: () => {
      lastQuery = search.value;
      applyFilter();
    },
  });
  const order = h(
    'select',
    {
      class: 'input gallery-order',
      ariaLabel: 'Kolejność',
      onchange: () => {
        lastOrder = order.value as SortOrder;
        applyOrder();
      },
    },
    h('option', { value: 'gallery' }, 'Kolejność galerii'),
    h('option', { value: 'name' }, 'Alfabetycznie'),
  );
  order.value = lastOrder;
  const grid = h('div', { class: 'gallery-grid' });
  const message = h('p', { class: 'muted gallery-message', hidden: true });

  const screen = h(
    'div',
    { class: 'gallery' },
    h('h1', {}, 'Galeria wzorów'),
    h('div', { class: 'gallery-controls' }, search, order),
    grid,
    message,
    h('footer', { class: 'gallery-footer' }, h('a', { class: 'muted small', href: '#kreator' }, 'Kreator')),
  );
  root.appendChild(screen);

  /** In gallery order. */
  const tiles: { name: string; element: HTMLElement }[] = [];

  function applyFilter() {
    let visible = 0;
    for (const tile of tiles) {
      tile.element.hidden = !matchesName(tile.name, search.value);
      if (!tile.element.hidden) visible++;
    }
    message.hidden = visible > 0;
    message.textContent = tiles.length === 0 ? 'Brak wzorów w galerii.' : 'Nie znaleziono wzorów.';
  }

  function applyOrder() {
    const sorted = order.value === 'name' ? [...tiles].sort((a, b) => compareNames(a.name, b.name)) : tiles;
    grid.replaceChildren(...sorted.map((t) => t.element));
  }

  loadEntries().then((entries) => {
    if (!active) return;
    const store = localStateStore(window.localStorage);
    for (const entry of entries) {
      const element = galleryTile(entry, store.load(fingerprint(entry.pattern))?.progress ?? 0);
      tiles.push({ name: entry.name, element });
    }
    applyOrder();
    applyFilter();
  });

  return () => {
    active = false;
    screen.remove();
  };
}

/** Decodes every gallery pattern in gallery order; payloads that fail to decode are skipped. */
async function loadEntries(): Promise<GalleryEntry[]> {
  const results = await Promise.allSettled(
    Object.entries(galleryPatterns).map(async ([name, payload]) => ({
      name,
      payload,
      pattern: (await decodePattern(payload)).pattern,
    })),
  );
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

function galleryTile({ name, payload, pattern }: GalleryEntry, progress: number) {
  const total = pattern.height;
  return h(
    'a',
    { class: 'tile', href: `#p=${payload}` },
    h('div', { class: 'tile-preview' }, patternThumbnail(pattern)),
    h('div', { class: 'tile-name' }, name),
    h('div', { class: 'muted small' }, `${pattern.width} × ${pattern.height}`),
    progress > 0 && tileProgress(progress, total),
  );
}

/** Progress saved on this device; nothing is shown for patterns never started. */
function tileProgress(done: number, total: number) {
  if (done >= total) return h('div', { class: 'tile-progress tile-done small' }, 'Ukończony');
  return h(
    'div',
    { class: 'tile-progress' },
    h('div', { class: 'progress-bar' }, h('div', { class: 'progress-fill', style: { width: `${(done / total) * 100}%` } })),
    h('span', { class: 'progress-text' }, `${done} / ${total}`),
  );
}
