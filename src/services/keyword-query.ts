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

/** Tokens for FTS — same splitting as normalizeKeywordQuery, as array. */
export function tokenizeForFts(query: string): string[] {
  const n = normalizeKeywordQuery(query);
  if (!n) return [];
  return n.split(/\s+/).filter(Boolean);
}

/**
 * Relaxed OR query for FTS5 when strict AND returns no rows.
 * Requires at least two tokens; returns null otherwise.
 */
export function buildFtsOrQuery(tokens: string[]): string | null {
  if (tokens.length < 2) return null;
  const parts = tokens.map((t) => t.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return parts.join(' OR ');
}
