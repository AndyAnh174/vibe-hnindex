import { minimatch } from 'minimatch';
import type { SearchResult } from '../types.js';

/** Paths that look like generated/vendor output — down-rank when still indexed. */
const DEPRIORITIZE_PATTERNS = [
  '**/.next/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/*.min.js',
  '**/node_modules/**',
] as const;

const MULTIPLIER = 0.42;

export function deprioritizeMultiplier(filePath: string): number {
  const p = filePath.replace(/\\/g, '/');
  for (const pattern of DEPRIORITIZE_PATTERNS) {
    if (minimatch(p, pattern, { dot: true })) return MULTIPLIER;
  }
  return 1;
}

export function applyPathQualityScores(
  results: SearchResult[],
  enabled: boolean
): SearchResult[] {
  if (!enabled || results.length === 0) return results;
  const adjusted = results.map((r) => ({
    ...r,
    score: r.score * deprioritizeMultiplier(r.filePath),
  }));
  adjusted.sort((a, b) => b.score - a.score);
  return adjusted;
}
