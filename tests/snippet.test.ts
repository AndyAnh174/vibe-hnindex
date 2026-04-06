import { describe, it, expect } from 'vitest';
import { truncateContentUnicode } from '../src/services/snippet.js';

describe('truncateContentUnicode', () => {
  it('returns unchanged when under limit', () => {
    expect(truncateContentUnicode('hello', 10)).toBe('hello');
  });

  it('truncates at code point boundary and appends ellipsis', () => {
    const s = 'a'.repeat(5) + '🔥' + 'b'.repeat(5);
    const out = truncateContentUnicode(s, 6);
    expect(out.endsWith('…')).toBe(true);
    expect([...out].length).toBeLessThanOrEqual(7 + 1);
  });

  it('returns empty for maxChars 0', () => {
    expect(truncateContentUnicode('x', 0)).toBe('');
  });
});
