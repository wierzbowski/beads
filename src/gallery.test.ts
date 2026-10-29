import { describe, expect, it } from 'vitest';
import { decodePattern } from './core/codec';
import { galleryPatterns } from './gallery';

describe('Gallery patterns', () => {
  it('all decode, so a truncated paste fails here instead of in the gallery', async () => {
    const report: string[] = [];
    const failed: string[] = [];
    for (const [name, payload] of Object.entries(galleryPatterns)) {
      try {
        if (payload.includes('#')) throw new Error('paste only the part after #p=');
        await decodePattern(payload);
        report.push(`testing pattern "${name}"... ✅`);
      } catch (e) {
        report.push(`testing pattern "${name}"... ❌ ${e instanceof Error ? e.message : e}`);
        failed.push(name);
      }
    }
    // One log for all patterns, so the report prints as a single block.
    if (report.length > 0) console.log(report.join('\n'));
    expect(failed).toEqual([]);
  });
});
