/**
 * LRU cache for search results with TTL (Time-To-Live).
 * Caches results to avoid redundant searches within a short window.
 */

import type { SearchResult } from '../types.js';

interface CacheEntry {
  results: SearchResult[];
  timestamp: number;
}

function getCacheSize(): number {
  const env = process.env.SEARCH_CACHE_SIZE?.trim();
  if (!env) return 100;
  const n = parseInt(env, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return 100;
}

function getCacheTTL(): number {
  const env = process.env.SEARCH_CACHE_TTL_MS?.trim();
  if (!env) return 300_000; // 5 minutes
  const n = parseInt(env, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return 300_000;
}

const maxSize = getCacheSize();
const ttlMs = getCacheTTL();

// Map keeps insertion order for LRU eviction
const cache = new Map<string, CacheEntry>();

/**
 * Build a cache key from search parameters.
 */
export function buildCacheKey(params: {
  projectName: string;
  query: string;
  mode: string;
  limit: number;
  filters?: Record<string, unknown>;
}): string {
  const filterStr = params.filters
    ? Object.entries(params.filters)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('|')
    : '';
  return [params.projectName, params.query, params.mode, params.limit, filterStr].join('|');
}

/**
 * Retrieve cached search results if valid (not expired).
 * Returns null if not found or expired.
 */
export function getCachedResult(key: string): SearchResult[] | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > ttlMs) {
    cache.delete(key);
    return null;
  }

  // Move to end (most recently used) by re-inserting
  cache.delete(key);
  cache.set(key, entry);

  return entry.results;
}

/**
 * Store search results in cache.
 * Evicts oldest entry if cache is full.
 */
export function setCachedResult(key: string, results: SearchResult[]): void {
  // Evict oldest if at capacity
  if (cache.size >= maxSize) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }

  cache.set(key, {
    results,
    timestamp: Date.now(),
  });
}

/**
 * Invalidate cached results for a specific project, or all if no project specified.
 */
export function invalidateCache(projectName?: string): void {
  if (!projectName) {
    cache.clear();
    return;
  }

  const prefix = `${projectName}|`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Get cache stats for debugging.
 */
export function getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  return { size: cache.size, maxSize, ttlMs };
}
