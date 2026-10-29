import { encodePattern, type DecodedLink } from '../core/codec';
import { fingerprint } from '../core/fingerprint';
import { colourTotals, rowHint } from '../core/pattern';
import {
  type CraftState,
  jumpToRow,
  localStateStore,
  markDone,
  reset,
  resolveState,
  toggleDirection,
  undo,
} from '../core/progress';
import { confirmDialog, h, showDialog } from './dom';
import { PatternViewer } from './patternViewer';
import { runChip, swatch } from './swatch';

const DOUBLE_TAP_GUARD_MS = 600;

const percentFormat = new Intl.NumberFormat('pl-PL', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const numberFormat = new Intl.NumberFormat('pl-PL');

const DIRECTION_LABEL = { ltr: 'od lewej do prawej', rtl: 'od prawej do lewej' } as const;
const DIRECTION_ARROW = { ltr: '→', rtl: '←' } as const;

export function renderCrafting(root: HTMLElement, { pattern, state: linkState }: DecodedLink): () => void {
  const total = pattern.height;
  const store = localStateStore(window.localStorage);
  const fp = fingerprint(pattern);
  let state = resolveState(linkState, store.load(fp), total);
  let lastDoneTap = 0;
  let urlUpdate = 0;

  document.title = `${pattern.name || 'Wzór'} · Koraliki`;

  const progressFill = h('div', { class: 'progress-fill' });
  const progressText = h('span', { class: 'progress-text' });
  const hintTitle = h('div', { class: 'hint-title' });
  const hintChips = h('div', { class: 'chips' });
  const nextHint = h('div', { class: 'next-hint' });
  const undoButton = h('button', { class: 'btn', onclick: onUndo }, 'Cofnij');
  const doneButton = h('button', { class: 'btn btn-primary btn-done', onclick: onDone }, 'Następny rządek');
  const menuButton = h('button', { class: 'btn btn-menu', ariaLabel: 'Więcej opcji', onclick: openMenu }, '⋯');
  const viewerBox = h('div', { class: 'viewer' });

  const screen = h(
    'div',
    { class: 'crafting' },
    h('header', { class: 'crafting-header' }, h('h1', {}, pattern.name || 'Wzór')),
    viewerBox,
    h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'progress' },
        h('div', { class: 'progress-bar' }, progressFill),
        progressText,
      ),
      h('div', { class: 'hint' }, hintTitle, hintChips, nextHint),
      h('div', { class: 'controls' }, undoButton, doneButton, menuButton),
    ),
  );
  root.appendChild(screen);

  const viewer = new PatternViewer(viewerBox, pattern, { fit: 'width', onRowTap });
  const releaseWakeLock = keepScreenAwake();

  function update(next: CraftState) {
    state = next;
    store.save(fp, state);
    syncUrl();
    render();
  }

  function syncUrl() {
    const request = ++urlUpdate;
    encodePattern(pattern, state).then((payload) => {
      if (request === urlUpdate) history.replaceState(null, '', `#p=${payload}`);
    });
  }

  function render() {
    const done = state.progress;
    progressFill.style.width = `${(done / total) * 100}%`;
    progressText.textContent = `${done} / ${total} · ${percentFormat.format(done / total)}`;

    const current = done + 1;
    if (current > total) {
      hintTitle.textContent = 'Wszystkie rzędy gotowe 🎉';
      hintChips.replaceChildren();
      nextHint.replaceChildren();
    } else {
      hintTitle.replaceChildren(
        `Rząd ${current} / ${total} (liczba kolumn: ${pattern.width}) `,
        h('span', { class: 'direction', title: DIRECTION_LABEL[state.direction] }, DIRECTION_ARROW[state.direction]),
      );
      hintChips.replaceChildren(...rowHint(pattern, current, state.direction).map((r) => runChip(r, pattern.palette)));
      nextHint.replaceChildren(
        ...(current < total
          ? [
              h('span', { class: 'next-label' }, 'Następny:'),
              ...rowHint(pattern, current + 1, state.direction).map((r) => runChip(r, pattern.palette)),
            ]
          : []),
      );
    }

    undoButton.disabled = done === 0;
    doneButton.disabled = done >= total;
    viewer.setState(state);
  }

  function onDone() {
    const now = performance.now();
    if (now - lastDoneTap < DOUBLE_TAP_GUARD_MS) return;
    lastDoneTap = now;
    if (state.progress >= total) return;
    navigator.vibrate?.(30);
    update(markDone(state, total));
    if (state.progress === total) celebrate();
  }

  function onUndo() {
    update(undo(state, total));
  }

  async function onRowTap(row: number) {
    const current = state.progress + 1;
    if (row === current) return;
    const ok = await confirmDialog(`Przejść do rzędu ${row}? Rzędy 1–${row - 1} zostaną oznaczone jako gotowe.`, 'Przejdź');
    if (ok) update(jumpToRow(state, row, total));
  }

  function celebrate() {
    const beadCount = pattern.width * pattern.height;
    showDialog(
      [
        h('div', { class: 'celebration' }, '🎉'),
        h('h2', {}, 'Gratulacje!'),
        h(
          'p',
          {},
          `Wzór „${pattern.name || 'bez nazwy'}” ukończony: ${total} rzędów, ${numberFormat.format(beadCount)} koralików.`,
        ),
      ],
      [{ label: 'Super!', value: undefined, primary: true }],
      undefined,
    );
  }

  async function openMenu() {
    const choice = await showDialog<'gallery' | 'direction' | 'totals' | 'reset' | null>(
      [h('h2', {}, 'Opcje')],
      [
        { label: 'Galeria', value: 'gallery' },
        { label: `Kierunek czytania: ${DIRECTION_LABEL[state.direction]} — zmień`, value: 'direction' },
        { label: 'Podsumowanie kolorów', value: 'totals' },
        { label: 'Resetuj postęp', value: 'reset', danger: true },
        { label: 'Zamknij', value: null },
      ],
      null,
    );
    if (choice === 'gallery') {
      location.href = import.meta.env.BASE_URL;
    } else if (choice === 'direction') {
      update(toggleDirection(state));
    } else if (choice === 'totals') {
      showTotals();
    } else if (choice === 'reset') {
      const ok = await confirmDialog('Zresetować postęp do zera? Wszystkie rzędy zostaną oznaczone jako niegotowe.', 'Resetuj', true);
      if (ok) update(reset(state));
    }
  }

  function showTotals() {
    const rows = colourTotals(pattern, state.progress).map((t) => {
      const colour = pattern.palette[t.colour];
      return h(
        'tr',
        {},
        h('td', {}, swatch(colour)),
        h('td', {}, colour.label),
        h('td', { class: 'num' }, numberFormat.format(t.remaining)),
        h('td', { class: 'num muted' }, numberFormat.format(t.total)),
      );
    });
    showDialog(
      [
        h('h2', {}, 'Podsumowanie kolorów'),
        h(
          'table',
          { class: 'totals' },
          h(
            'thead',
            {},
            h('tr', {}, h('th', {}), h('th', {}, 'Kolor'), h('th', { class: 'num' }, 'Zostało'), h('th', { class: 'num' }, 'Razem')),
          ),
          h('tbody', {}, ...rows),
        ),
      ],
      [{ label: 'Zamknij', value: undefined, primary: true }],
      undefined,
    );
  }

  store.save(fp, state);
  syncUrl();
  render();

  return () => {
    releaseWakeLock();
    viewer.destroy();
    screen.remove();
  };
}

/** Keeps the screen on while the page is visible; silently does nothing where unsupported. */
function keepScreenAwake(): () => void {
  let sentinel: WakeLockSentinel | null = null;
  let active = true;

  const acquire = async () => {
    if (!active || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
    } catch {
      sentinel = null;
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') acquire();
  };

  document.addEventListener('visibilitychange', onVisibility);
  acquire();

  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVisibility);
    sentinel?.release().catch(() => {});
  };
}
