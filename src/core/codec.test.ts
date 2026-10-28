import { describe, expect, it } from 'vitest';
import { decodePattern, encodePattern, PatternLinkError, patternLinkUrl, payloadFromLink } from './codec';
import { patternFromRows } from './testPatterns';
import type { Pattern } from './pattern';

const pattern: Pattern = {
  ...patternFromRows(['RRGGB', 'BBBBB', 'RRRGB'], 'Bransoletka żółta ✨'),
};
pattern.palette[0].label = 'DB-0010 czerwony';

describe('Pattern Link codec', () => {
  it('round-trips pattern and state', async () => {
    const payload = await encodePattern(pattern, { progress: 2, direction: 'rtl' });
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = await decodePattern(payload);
    expect(decoded.pattern).toEqual(pattern);
    expect(decoded.state).toEqual({ progress: 2, direction: 'rtl' });
  });

  it('round-trips a single-colour pattern', async () => {
    const plain = patternFromRows(['WWW', 'WWW']);
    const decoded = await decodePattern(await encodePattern(plain, { progress: 0, direction: 'ltr' }));
    expect(decoded.pattern).toEqual(plain);
  });

  it('keeps a typical pattern short', async () => {
    const width = 17;
    const height = 67;
    const big: Pattern = {
      name: 'Wzór',
      width,
      height,
      palette: patternFromRows(['RGBWK']).palette,
      beads: Array.from({ length: width * height }, (_, i) => Math.floor(i / 7) % 5),
    };
    const payload = await encodePattern(big, { progress: 12, direction: 'ltr' });
    expect(payload.length).toBeLessThan(600);
    expect((await decodePattern(payload)).pattern).toEqual(big);
  });

  it('refuses to encode a pattern over the size limit', async () => {
    const wide = patternFromRows(['R'.repeat(51)]);
    await expect(encodePattern(wide, { progress: 0, direction: 'ltr' })).rejects.toBeInstanceOf(PatternLinkError);
  });

  it('rejects garbage', async () => {
    await expect(decodePattern('not*base64')).rejects.toBeInstanceOf(PatternLinkError);
    await expect(decodePattern('AQ')).rejects.toBeInstanceOf(PatternLinkError);
    await expect(decodePattern('AUFBQUFB')).rejects.toBeInstanceOf(PatternLinkError);
  });

  it('rejects an unknown format version', async () => {
    const payload = await encodePattern(pattern, { progress: 0, direction: 'ltr' });
    const tampered = 'Ag' + payload.slice(2); // first byte 0x02
    await expect(decodePattern(tampered)).rejects.toThrow(/nowszej wersji/);
  });

  it('rejects a truncated link', async () => {
    const payload = await encodePattern(pattern, { progress: 0, direction: 'ltr' });
    await expect(decodePattern(payload.slice(0, payload.length - 6))).rejects.toBeInstanceOf(PatternLinkError);
  });
});

describe('link helpers', () => {
  it('builds and parses links', () => {
    const url = patternLinkUrl('https://wierzbowski.github.io/beads/', 'abc-_123');
    expect(url).toBe('https://wierzbowski.github.io/beads/#p=abc-_123');
    expect(payloadFromLink(url)).toBe('abc-_123');
    expect(payloadFromLink('#p=xyz')).toBe('xyz');
  });

  it('returns null without a payload', () => {
    expect(payloadFromLink('https://wierzbowski.github.io/beads/')).toBeNull();
    expect(payloadFromLink('')).toBeNull();
    expect(payloadFromLink('#')).toBeNull();
  });
});
