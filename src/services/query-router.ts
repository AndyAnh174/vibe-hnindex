/**
 * Resolve search mode when the client passes `auto` or SEARCH_AUTO_ROUTE treats missing mode as auto.
 */
export type ResolvedSearchMode = 'keyword' | 'semantic' | 'hybrid' | 'regex';

/**
 * Check if a query likely contains spelling errors or typos that would benefit from fuzzy search.
 * Heuristic: repeated characters (≥3), very long words, common misspelling patterns.
 */
export function detectQueryTypos(query: string): boolean {
  if (!query || query.length < 3) return false;

  // Repeated character patterns (e.g., "helllo", "wooord")
  if (/(.)\1{2,}/.test(query)) return true;

  // Very long words (>15 chars) are suspicious in code search
  const words = query.split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (w.length > 15) return true;
  }

  // Common misspelling patterns
  const misspellings = [
    /\bie\b.*\bie\b/,
    /\bteh\b/,
    /\bfucntion\b/,
    /\breutrn\b/,
    /\bretrun\b/,
    /\bconosle\b/,
    /\bconsle\b/,
    /\bimprot\b/,
    /\bexpot\b/,
    /\bdocumnet\b/,
  ];

  for (const pattern of misspellings) {
    if (pattern.test(query)) return true;
  }

  return false;
}

/** Detect if query looks like a regex pattern: /pattern/flags */
export function isRegexPattern(query: string): boolean {
  const q = query.trim();
  if (!q.startsWith('/') || q.length < 3) return false;
  // Look for closing / optionally followed by flags
  const closingMatch = q.match(/^\/(.+)\/([gimsuy]*)$/);
  return closingMatch !== null;
}

/** Extract pattern and flags from /pattern/flags syntax */
export function parseRegexQuery(query: string): { pattern: string; flags: string } | null {
  const q = query.trim();
  if (!q.startsWith('/')) return null;
  const m = q.match(/^\/(.+)\/([gimsuy]*)$/);
  if (!m) return null;
  return { pattern: m[1], flags: m[2] || 'i' };
}

export function resolveSearchMode(
  query: string,
  mode: 'keyword' | 'semantic' | 'hybrid' | 'auto' | 'regex'
): ResolvedSearchMode {
  if (mode === 'regex') return 'regex';
  if (mode === 'auto' && isRegexPattern(query)) return 'regex';
  if (mode !== 'auto') return mode;

  const q = query.trim();
  const wordCount = q.split(/\s+/).filter(Boolean).length;
  const shortQuery = q.length < 40 && wordCount <= 3;

  const pathLike =
    /[\\/]/.test(q) ||
    /\.[a-zA-Z0-9]{1,8}\b/.test(q) ||
    /\b[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*\b/.test(q) ||
    /\b[a-z]+_[a-z_]+\b/i.test(q);

  if (shortQuery && pathLike) return 'keyword';

  const questionWords =
    /\b(how|where|what|why|when|which|explain|describe|implement|does|is there)\b/i;
  if (wordCount > 6 || questionWords.test(q) || q.length > 80) return 'hybrid';
  if (wordCount >= 4) return 'hybrid';

  return 'keyword';
}
