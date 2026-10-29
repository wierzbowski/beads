/** Lower-cases and strips Polish (and other) diacritics, so `Żółw` and `zolw` compare equal. */
export function normaliseForSearch(text: string): string {
  return text
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // ł has no decomposed form, so NFD leaves it alone.
    .replace(/ł/g, 'l')
    .trim();
}

/** True when the pattern name contains the query, ignoring case and diacritics; an empty query matches everything. */
export function matchesName(name: string, query: string): boolean {
  return normaliseForSearch(name).includes(normaliseForSearch(query));
}
