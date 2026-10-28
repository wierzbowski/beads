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
