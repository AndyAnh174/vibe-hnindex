/**
 * Resolve search mode when the client passes `auto` or SEARCH_AUTO_ROUTE treats missing mode as auto.
 */
export type ResolvedSearchMode = 'keyword' | 'semantic' | 'hybrid';

export function resolveSearchMode(
  query: string,
  mode: 'keyword' | 'semantic' | 'hybrid' | 'auto'
): ResolvedSearchMode {
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
