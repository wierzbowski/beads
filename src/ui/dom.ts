type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown>;

/** Creates an element; `on*` props become event listeners, `class` sets the class name. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (key === 'class') {
      el.className = String(value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else {
      Reflect.set(el, key, value);
    }
  }
  append(el, children);
  return el;
}

export function append(parent: Node, children: Child[]) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

interface DialogButton<T> {
  label: string;
  value: T;
  primary?: boolean;
  danger?: boolean;
}

/** Modal dialog built on <dialog>; resolves with the chosen button's value, or `dismissValue` on Escape/backdrop. */
export function showDialog<T>(content: Child[], buttons: DialogButton<T>[], dismissValue: T): Promise<T> {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'dialog' });
    let result = dismissValue;
    const actions = h(
      'div',
      { class: 'dialog-actions' },
      ...buttons.map((b) =>
        h(
          'button',
          {
            class: ['btn', b.primary && 'btn-primary', b.danger && 'btn-danger'].filter(Boolean).join(' '),
            onclick: () => {
              result = b.value;
              dialog.close();
            },
          },
          b.label,
        ),
      ),
    );
    append(dialog, [h('div', { class: 'dialog-body' }, ...content), actions]);
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(result);
    });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

export function confirmDialog(message: string, confirmLabel: string, danger = false): Promise<boolean> {
  return showDialog(
    [h('p', {}, message)],
    [
      { label: 'Anuluj', value: false },
      { label: confirmLabel, value: true, primary: !danger, danger },
    ],
    false,
  );
}

/**
 * Stops a control from changing unless `allow()` says yes: inputs are blocked on press and key, buttons on click.
 * `allow` decides synchronously; it may start an async confirmation, after which the user repeats the action.
 */
export function guardControl(el: HTMLInputElement | HTMLButtonElement, allow: () => boolean) {
  const block = (e: Event) => {
    // Moving focus and shortcuts don't change the value.
    if (e instanceof KeyboardEvent && (['Tab', 'Shift', 'Escape'].includes(e.key) || e.ctrlKey || e.metaKey || e.altKey)) {
      return;
    }
    if (allow()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === 'pointerdown') {
      // A range input starts dragging on press; disabling it for the press keeps the thumb where it is.
      const wasDisabled = el.disabled;
      el.disabled = true;
      requestAnimationFrame(() => (el.disabled = wasDisabled));
    }
  };
  const events = el instanceof HTMLButtonElement ? ['click'] : ['pointerdown', 'keydown'];
  for (const type of events) el.addEventListener(type, block, { capture: true });
}

let toastTimer: number | undefined;

export function toast(message: string) {
  let el = document.querySelector<HTMLDivElement>('.toast');
  if (!el) {
    el = h('div', { class: 'toast', role: 'status' });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('visible'), 2200);
}
