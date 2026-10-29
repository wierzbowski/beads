import { decodePattern, payloadFromLink } from '../core/codec';
import { fingerprint } from '../core/fingerprint';
import { matchesName } from '../core/nameSearch';
import type { Pattern } from '../core/pattern';
import { localStateStore } from '../core/progress';
import { galleryLinks } from '../gallery';
import { h } from './dom';
import { patternThumbnail } from './patternThumbnail';

interface GalleryEntry {
  payload: string;
  pattern: Pattern;
}

/** Kept across visits, so going Back from a pattern keeps the search. */
let lastQuery = '';

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
  const grid = h('div', { class: 'gallery-grid' });
  const message = h('p', { class: 'muted gallery-message', hidden: true });

  const screen = h(
    'div',
    { class: 'gallery' },
    h('h1', {}, 'Galeria wzorów'),
    search,
    grid,
    message,
    h('footer', { class: 'gallery-footer' }, h('a', { class: 'muted small', href: '#kreator' }, 'Kreator')),
  );
  root.appendChild(screen);

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

  loadEntries().then((entries) => {
    if (!active) return;
    const store = localStateStore(window.localStorage);
    for (const entry of entries) {
      const element = galleryTile(entry, store.load(fingerprint(entry.pattern))?.progress ?? 0);
      tiles.push({ name: entry.pattern.name, element });
      grid.appendChild(element);
    }
    applyFilter();
  });

  return () => {
    active = false;
    screen.remove();
  };
}

/** Decodes every gallery link in file order; links that fail to decode are skipped. */
async function loadEntries(): Promise<GalleryEntry[]> {
  const results = await Promise.allSettled(
    galleryLinks.map(async (link) => {
      const payload = payloadFromLink(link);
      if (!payload) throw new Error('No payload');
      return { payload, pattern: (await decodePattern(payload)).pattern };
    }),
  );
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

function galleryTile({ payload, pattern }: GalleryEntry, progress: number) {
  const total = pattern.height;
  return h(
    'a',
    { class: 'tile', href: `#p=${payload}` },
    h('div', { class: 'tile-preview' }, patternThumbnail(pattern)),
    h('div', { class: 'tile-name' }, pattern.name || 'Bez nazwy'),
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
