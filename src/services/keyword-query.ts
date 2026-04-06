/**
 * Normalize user input for FTS5 keyword search: punctuation-heavy queries
 * (e.g. products.urls, admin/products) often match poorly when passed raw.
 * Splits into letter/number tokens separated by spaces (FTS5 AND semantics).
 */
export function normalizeKeywordQuery(query: string): string {
  const withoutQuotes = query.replace(/['"]/g, ' ');
  const tokenized = withoutQuotes
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return tokenized;
}
