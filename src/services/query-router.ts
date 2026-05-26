/**
 * Resolve search mode when the client passes `auto` or SEARCH_AUTO_ROUTE treats missing mode as auto.
 */
export type ResolvedSearchMode = 'keyword' | 'semantic' | 'hybrid' | 'regex';

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
