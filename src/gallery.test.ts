import { describe, expect, it } from 'vitest';
import { decodePattern, payloadFromLink } from './core/codec';
import { galleryLinks } from './gallery';

describe('Gallery links', () => {
  it('all decode, so a truncated paste fails here instead of in the gallery', async () => {
    for (const link of galleryLinks) {
      const payload = payloadFromLink(link);
      expect(payload, link).not.toBeNull();
      await expect(decodePattern(payload!), link).resolves.toBeDefined();
    }
  });
});
