import { describe, expect, it } from 'vitest';
import { decodePattern } from './core/codec';
import { galleryPatterns } from './gallery';

describe('Gallery patterns', () => {
  it('all decode, so a truncated paste fails here instead of in the gallery', async () => {
    for (const [name, payload] of Object.entries(galleryPatterns)) {
      expect(payload, name).not.toContain('#');
      await expect(decodePattern(payload), name).resolves.toBeDefined();
    }
  });
});
