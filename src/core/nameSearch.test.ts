import { describe, expect, it } from 'vitest';
import { matchesName, normaliseForSearch } from './nameSearch';

describe('Gallery name search', () => {
  it('ignores case and Polish diacritics', () => {
    expect(normaliseForSearch('ŻÓŁW Łąka Ćma Źrebię Śnieg Ńą Ęę')).toBe('zolw laka cma zrebie snieg na ee');
  });

  it('matches a substring of the name', () => {
    expect(matchesName('Bransoletka – żółw', 'zolw')).toBe(true);
    expect(matchesName('Bransoletka – żółw', 'BRANS')).toBe(true);
    expect(matchesName('Bransoletka – żółw', 'Żółw')).toBe(true);
    expect(matchesName('Bransoletka – żółw', 'kot')).toBe(false);
  });

  it('matches everything for an empty or blank query', () => {
    expect(matchesName('Cokolwiek', '')).toBe(true);
    expect(matchesName('Cokolwiek', '   ')).toBe(true);
  });
});
