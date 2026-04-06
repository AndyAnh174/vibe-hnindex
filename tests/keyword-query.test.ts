import { describe, it, expect } from 'vitest';
import {
  normalizeKeywordQuery,
  tokenizeForFts,
  buildFtsOrQuery,
} from '../src/services/keyword-query.js';

describe('normalizeKeywordQuery', () => {
  it('splits dotted and slashed identifiers into tokens', () => {
    expect(normalizeKeywordQuery('products.urls')).toBe('products urls');
    expect(normalizeKeywordQuery('admin/products')).toBe('admin products');
  });

  it('strips quotes then tokenizes', () => {
    expect(normalizeKeywordQuery(`foo'bar.baz`)).toBe('foo bar baz');
  });

  it('collapses whitespace and trims', () => {
    expect(normalizeKeywordQuery('  a  (b)  c  ')).toBe('a b c');
  });

  it('preserves unicode letters and numbers', () => {
    expect(normalizeKeywordQuery('café_42')).toBe('café 42');
  });
});

describe('tokenizeForFts', () => {
  it('matches normalizeKeywordQuery token split', () => {
    expect(tokenizeForFts('products.urls')).toEqual(['products', 'urls']);
    expect(tokenizeForFts('  a  b  ')).toEqual(['a', 'b']);
  });

  it('returns empty for whitespace-only', () => {
    expect(tokenizeForFts('   ')).toEqual([]);
  });
});

describe('buildFtsOrQuery', () => {
  it('returns null for fewer than two tokens', () => {
    expect(buildFtsOrQuery(['a'])).toBeNull();
    expect(buildFtsOrQuery([])).toBeNull();
  });

  it('joins tokens with OR', () => {
    expect(buildFtsOrQuery(['foo', 'bar', 'baz'])).toBe('foo OR bar OR baz');
  });
});
