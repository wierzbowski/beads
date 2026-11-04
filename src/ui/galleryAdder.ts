import { decodePattern } from '../core/codec';
import { fingerprint } from '../core/fingerprint';
import type { Pattern } from '../core/pattern';
import { GALLERY_ENDPOINT, GALLERY_NAME, type GalleryWriteResult, toGalleryName } from '../galleryFile';
import { h } from './dom';

/** Dodaj do galerii (ADR-0005): only created under `pnpm dev`, writes `src/gallery.ts` through the dev-server plugin. */
export interface GalleryAdder {
  /** Sits in the share card's button row. */
  button: HTMLButtonElement;
  /** Name field, confirm button and messages, shown below the link once the button is clicked. */
  panel: HTMLElement;
  /** Called whenever the link changes; `null` while there is no shareable link. */
  setLink(pattern: Pattern | null, payload: string | null): void;
}

/** A warning the user has seen; confirming again with the same name and payload goes ahead. */
interface Pending {
  name: string;
  payload: string;
  replace: boolean;
}

export function createGalleryAdder(): GalleryAdder {
  let pattern: Pattern | null = null;
  let payload: string | null = null;
  let pending: Pending | null = null;
  let busy = false;

  const nameInput = h('input', {
    class: 'input',
    placeholder: 'np. bransoletka_paski',
    oninput: () => {
      nameInput.value = toGalleryName(nameInput.value);
      reset();
    },
    onkeydown: (e: KeyboardEvent) => e.key === 'Enter' && onConfirm(),
  });
  const confirmButton = h('button', { class: 'btn btn-primary', onclick: onConfirm }, 'Dodaj');
  const message = h('p', { class: 'small', hidden: true });
  const panel = h(
    'div',
    { class: 'gallery-adder', hidden: true },
    h('label', { class: 'field' }, h('span', {}, 'Nazwa w galerii'), h('div', { class: 'row' }, nameInput, confirmButton)),
    message,
  );
  const button = h('button', { class: 'btn', disabled: true, onclick: onOpen }, 'Dodaj do galerii');

  function onOpen() {
    if (panel.hidden) {
      panel.hidden = false;
      nameInput.value = toGalleryName(pattern?.name ?? '');
      reset();
    }
    nameInput.focus();
  }

  /** Forgets a seen warning after the name or the pattern changed. */
  function reset() {
    pending = null;
    confirmButton.textContent = 'Dodaj';
    message.hidden = true;
    updateConfirm();
  }

  function updateConfirm() {
    confirmButton.disabled = busy || !payload || !GALLERY_NAME.test(nameInput.value);
  }

  function show(text: string, kind: 'muted' | 'error') {
    message.textContent = text;
    message.className = `small ${kind}`;
    message.hidden = false;
  }

  async function onConfirm() {
    const name = nameInput.value;
    if (confirmButton.disabled || !payload || !pattern) return;
    const current = { pattern, payload };
    busy = true;
    updateConfirm();
    try {
      if (pending && pending.name === name && pending.payload === current.payload) {
        await write(name, current.payload, pending.replace);
      } else {
        await check(name, current.pattern, current.payload);
      }
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      busy = false;
      updateConfirm();
    }
  }

  /** Checks the gallery on disk; writes straight away unless there is something to confirm. */
  async function check(name: string, p: Pattern, newPayload: string) {
    const { entries } = await request<{ entries: Record<string, string> }>('GET');
    const existing = entries[name];
    if (existing === newPayload) return show(`„${name}” jest już w galerii.`, 'muted');

    const id = fingerprint(p);
    const samePattern: string[] = [];
    for (const [other, otherPayload] of Object.entries(entries)) {
      if (other === name) continue;
      try {
        if (fingerprint((await decodePattern(otherPayload)).pattern) === id) samePattern.push(other);
      } catch {
        // A broken entry is the gallery test's job to report.
      }
    }

    const warnings: string[] = [];
    if (existing !== undefined) warnings.push(`Nazwa „${name}” jest już w galerii — „Zastąp” podmieni jej wzór.`);
    if (samePattern.length > 0) warnings.push(`Ten wzór jest już w galerii jako ${samePattern.map((n) => `„${n}”`).join(', ')}.`);
    if (warnings.length === 0) return write(name, newPayload, false);

    pending = { name, payload: newPayload, replace: existing !== undefined };
    confirmButton.textContent = existing !== undefined ? 'Zastąp' : 'Dodaj mimo to';
    show(warnings.join(' '), 'error');
  }

  async function write(name: string, newPayload: string, replace: boolean) {
    const { result } = await request<{ result: GalleryWriteResult }>('POST', { name, payload: newPayload, replace });
    pending = null;
    confirmButton.textContent = 'Dodaj';
    if (result === 'taken') {
      // Someone else (e.g. a hand edit) took the name since the check: start over.
      return show(`Nazwa „${name}” została w międzyczasie zajęta. Kliknij „Dodaj” ponownie.`, 'error');
    }
    const texts: Record<Exclude<GalleryWriteResult, 'taken'>, string> = {
      added: `Dodano „${name}” do src/gallery.ts.`,
      replaced: `Zastąpiono „${name}” w src/gallery.ts.`,
      unchanged: `„${name}” jest już w galerii.`,
    };
    show(texts[result], 'muted');
  }

  return {
    button,
    panel,
    setLink(nextPattern, nextPayload) {
      const changed = nextPayload !== payload;
      pattern = nextPattern;
      payload = nextPayload;
      button.disabled = !nextPayload;
      if (changed) reset();
    },
  };
}

async function request<T>(method: 'GET' | 'POST', body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(GALLERY_ENDPOINT, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Brak połączenia z serwerem deweloperskim (pnpm dev).');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data === null) throw new Error(data?.error ?? `Serwer deweloperski odpowiedział błędem ${res.status}.`);
  return data as T;
}
