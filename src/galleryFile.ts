/**
 * Text edits to `src/gallery.ts` for the Creator's Dodaj do galerii (ADR-0005).
 * Only the inserted line or the swapped payload string changes; the rest of the file stays byte-for-byte the same.
 */

/** Where the Creator talks to the dev server's gallery plugin; outside the app's base, so routing never sees it. */
export const GALLERY_ENDPOINT = '/__gallery';

/** A Gallery Name: a–z, digits and `_`, starting with a letter (so it never sorts as a number-like key). */
export const GALLERY_NAME = /^[a-z][a-z0-9_]*$/;
const PAYLOAD = /^[A-Za-z0-9_-]+$/;
const OPENING = /export const galleryPatterns: Record<string, string> = \{(\r?\n)/;
const ENTRY = /([A-Za-z_$][\w$]*)\s*:\s*'([^'\\\r\n]*)'/g;

export class GalleryFileError extends Error {}

/** Converts typed text towards a Gallery Name: `Liście 2` → `liscie_2`. The result may still need a leading letter. */
export function toGalleryName(text: string): string {
  return text
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // ł has no decomposed form, so NFD leaves it alone.
    .replace(/ł/g, 'l')
    .replace(/[\s-]/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

interface Entry {
  name: string;
  payload: string;
  /** Offset of the payload string's first character (inside the quotes). */
  payloadStart: number;
}

function parse(source: string): { entries: Entry[]; bodyStart: number } {
  const opening = OPENING.exec(source);
  if (!opening) throw new GalleryFileError('Nie znaleziono listy galleryPatterns w src/gallery.ts.');
  const bodyStart = opening.index + opening[0].length;
  const bodyEnd = source.indexOf('};', bodyStart);
  if (bodyEnd < 0) throw new GalleryFileError('Lista galleryPatterns w src/gallery.ts nie jest zamknięta.');
  const entries: Entry[] = [];
  for (const m of source.slice(bodyStart, bodyEnd).matchAll(ENTRY)) {
    entries.push({ name: m[1], payload: m[2], payloadStart: bodyStart + m.index + m[0].length - m[2].length - 1 });
  }
  return { entries, bodyStart };
}

/** Gallery Name → payload, in file order. */
export function readGallery(source: string): Record<string, string> {
  return Object.fromEntries(parse(source).entries.map((e) => [e.name, e.payload]));
}

export type GalleryWriteResult = 'added' | 'replaced' | 'unchanged' | 'taken';

/**
 * Adds a new entry at the top, or swaps the payload of an existing one when `replace` is set.
 * A taken name without `replace` leaves the file as it is, so a stale confirmation can't overwrite.
 */
export function writeGalleryEntry(
  source: string,
  name: string,
  payload: string,
  replace: boolean,
): { source: string; result: GalleryWriteResult } {
  if (!GALLERY_NAME.test(name)) throw new GalleryFileError(`Nieprawidłowa nazwa w galerii: „${name}”.`);
  if (!PAYLOAD.test(payload)) throw new GalleryFileError('Nieprawidłowy link do wzoru.');
  const { entries, bodyStart } = parse(source);
  const existing = entries.find((e) => e.name === name);
  if (existing) {
    if (existing.payload === payload) return { source, result: 'unchanged' };
    if (!replace) return { source, result: 'taken' };
    const end = existing.payloadStart + existing.payload.length;
    return { source: source.slice(0, existing.payloadStart) + payload + source.slice(end), result: 'replaced' };
  }
  const eol = OPENING.exec(source)![1];
  const line = `  ${name}: '${payload}',${eol}`;
  return { source: source.slice(0, bodyStart) + line + source.slice(bodyStart), result: 'added' };
}
