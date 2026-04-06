import { describe, it, expect } from 'vitest';
import { normalizeKeywordQuery } from '../src/services/keyword-query.js';

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
