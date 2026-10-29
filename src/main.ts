import './style.css';
import { decodePattern, PatternLinkError, payloadFromLink } from './core/codec';
import { renderCrafting } from './ui/crafting';
import { renderCreator } from './ui/creator';
import { h } from './ui/dom';
import { renderGallery } from './ui/gallery';

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;
let routeRequest = 0;

async function route() {
  const request = ++routeRequest;
  const payload = payloadFromLink(location.hash);

  if (!payload) {
    show(() => (location.hash === '#kreator' ? renderCreator(app) : renderGallery(app)));
    return;
  }

  try {
    const decoded = await decodePattern(payload);
    if (request === routeRequest) show(() => renderCrafting(app, decoded));
  } catch (e) {
    if (request !== routeRequest) return;
    const message = e instanceof PatternLinkError ? e.message : 'Nieznany błąd.';
    show(() => renderLinkError(message));
  }
}

function show(render: () => () => void) {
  cleanup?.();
  app.replaceChildren();
  cleanup = render();
}

function renderLinkError(message: string): () => void {
  document.title = 'Błąd · Koraliki';
  const screen = h(
    'div',
    { class: 'creator' },
    h('h1', {}, 'Nie udało się otworzyć wzoru'),
    h(
      'section',
      { class: 'card' },
      h('p', { class: 'error' }, message),
      h('p', { class: 'muted' }, 'Sprawdź, czy link został skopiowany w całości.'),
      h('a', { class: 'btn', href: '#kreator' }, 'Przejdź do kreatora'),
    ),
  );
  app.appendChild(screen);
  return () => screen.remove();
}

window.addEventListener('hashchange', route);
route();
