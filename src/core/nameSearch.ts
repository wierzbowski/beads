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

const nameCollator = new Intl.Collator('pl', { numeric: true, sensitivity: 'base' });

/** Alphabetical order of pattern names, Polish letters in place (Ł after L) and numbers by value (2 before 10). */
export function compareNames(a: string, b: string): number {
  return nameCollator.compare(a, b);
}

/** True when the pattern name contains the query, ignoring case and diacritics; an empty query matches everything. */
export function matchesName(name: string, query: string): boolean {
  return normaliseForSearch(name).includes(normaliseForSearch(query));
}
