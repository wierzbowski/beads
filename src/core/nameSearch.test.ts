import { describe, expect, it } from 'vitest';
import { compareNames, matchesName, normaliseForSearch } from './nameSearch';

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

describe('Gallery name order', () => {
  it('sorts alphabetically with Polish letters in place, ignoring case', () => {
    expect(['Żaba', 'zebra', 'Łoś', 'lis', 'Mysz', 'ćma', 'Cebula'].sort(compareNames)).toEqual([
      'Cebula',
      'ćma',
      'lis',
      'Łoś',
      'Mysz',
      'zebra',
      'Żaba',
    ]);
  });

  it('sorts numbers by value', () => {
    expect(['payday_20', 'payday_3', 'payday_100'].sort(compareNames)).toEqual(['payday_3', 'payday_20', 'payday_100']);
  });
});
