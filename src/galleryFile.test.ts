import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { galleryPatterns } from './gallery';
import { GALLERY_NAME, GalleryFileError, readGallery, toGalleryName, writeGalleryEntry } from './galleryFile';

const source = [
  '/** Header comment. */',
  'export const galleryPatterns: Record<string, string> = {',
  '  jamnik:',
  "    'AAA',",
  "  kot_2: 'BBB',",
  '};',
  '',
].join('\n');

describe('toGalleryName', () => {
  it('lower-cases, replaces Polish letters, turns spaces and hyphens into underscores', () => {
    expect(toGalleryName('Liście 2')).toBe('liscie_2');
    expect(toGalleryName('Żółw-Łódź')).toBe('zolw_lodz');
  });

  it('drops any other character', () => {
    expect(toGalleryName('Kot (nowy)!')).toBe('kot_nowy');
  });

  it('keeps a trailing underscore while typing', () => {
    expect(toGalleryName('kot ')).toBe('kot_');
  });
});

describe('GALLERY_NAME', () => {
  it('needs a leading letter', () => {
    expect(GALLERY_NAME.test('kot_2')).toBe(true);
    expect(GALLERY_NAME.test('2024_kot')).toBe(false);
    expect(GALLERY_NAME.test('_kot')).toBe(false);
    expect(GALLERY_NAME.test('')).toBe(false);
  });

  it('accepts every name already in the gallery', () => {
    for (const name of Object.keys(galleryPatterns)) expect(GALLERY_NAME.test(name)).toBe(true);
  });
});

describe('readGallery', () => {
  it('reads one- and two-line entries in file order', () => {
    expect(Object.entries(readGallery(source))).toEqual([
      ['jamnik', 'AAA'],
      ['kot_2', 'BBB'],
    ]);
  });

  it('matches the real gallery file', () => {
    expect(readGallery(readFileSync(new URL('./gallery.ts', import.meta.url), 'utf8'))).toEqual(galleryPatterns);
  });

  it('rejects a file without the gallery list', () => {
    expect(() => readGallery('export const x = {};')).toThrow(GalleryFileError);
  });
});

describe('writeGalleryEntry', () => {
  it('inserts a new name as one line at the top', () => {
    const { source: next, result } = writeGalleryEntry(source, 'pies', 'CCC', false);
    expect(result).toBe('added');
    expect(next).toBe(source.replace('= {\n', "= {\n  pies: 'CCC',\n"));
  });

  it('keeps CRLF line endings', () => {
    const crlf = source.replace(/\n/g, '\r\n');
    expect(writeGalleryEntry(crlf, 'pies', 'CCC', false).source).toBe(crlf.replace('= {\r\n', "= {\r\n  pies: 'CCC',\r\n"));
  });

  it('replaces only the payload of a two-line entry', () => {
    const { source: next, result } = writeGalleryEntry(source, 'jamnik', 'NEW', true);
    expect(result).toBe('replaced');
    expect(next).toBe(source.replace("'AAA'", "'NEW'"));
  });

  it('replaces only the payload of a one-line entry', () => {
    expect(writeGalleryEntry(source, 'kot_2', 'NEW', true).source).toBe(source.replace("'BBB'", "'NEW'"));
  });

  it('leaves a taken name alone without replace', () => {
    expect(writeGalleryEntry(source, 'jamnik', 'NEW', false)).toEqual({ source, result: 'taken' });
  });

  it('writes nothing for an identical payload', () => {
    expect(writeGalleryEntry(source, 'jamnik', 'AAA', true)).toEqual({ source, result: 'unchanged' });
  });

  it('rejects invalid names and payloads', () => {
    expect(() => writeGalleryEntry(source, '2kot', 'CCC', false)).toThrow(GalleryFileError);
    expect(() => writeGalleryEntry(source, 'pies', "CC'C", false)).toThrow(GalleryFileError);
  });
});
