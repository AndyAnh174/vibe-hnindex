/**
 * Filter search results by symbol kind.
 * Only returns chunks from files that contain symbols of the specified kind.
 */
import type { SearchResult, SymbolKind } from '../types.js';
import { getDb } from './sqlite.js';

const VALID_KINDS: ReadonlySet<string> = new Set([
  'function',
  'class',
  'method',
  'interface',
  'type',
  'variable',
  'enum',
  'export',
]);

/**
 * Normalize and validate the symbol kind filter.
 * 'export' is a pseudo-kind that matches any exported symbol.
 */
export function normalizeSymbolKind(kind: string): SymbolKind | 'export' | null {
  const lower = kind.toLowerCase();
  if (lower === 'export') return 'export';
  if (VALID_KINDS.has(lower)) return lower as SymbolKind;
  return null;
}

/**
 * Get the set of file paths that have symbols of the given kind.
 */
function getFilesWithSymbolKind(projectName: string, kind: string): Set<string> {
  const db = getDb();
  let sql: string;
  let params: unknown[];

  if (kind === 'export') {
    sql = `SELECT DISTINCT file_path FROM symbols WHERE project_name = ? AND exported = 1`;
    params = [projectName];
  } else {
    sql = `SELECT DISTINCT file_path FROM symbols WHERE project_name = ? AND kind = ?`;
    params = [projectName, kind];
  }

  const rows = db.prepare(sql).all(...params) as Array<{ file_path: string }>;
  return new Set(rows.map(r => r.file_path));
}

/**
 * Filter search results to only include chunks from files
 * that contain symbols of the specified kind.
 */
export function filterBySymbolKind(
  results: SearchResult[],
  projectName: string,
  kind: string
): SearchResult[] {
  const normalized = normalizeSymbolKind(kind);
  if (!normalized) {
    console.warn(`[symbol-filter] Unknown symbol kind: "${kind}". Valid: ${[...VALID_KINDS].join(', ')}, export`);
    return results;
  }

  const matchingFiles = getFilesWithSymbolKind(projectName, normalized);
  if (matchingFiles.size === 0) return [];

  return results.filter(r => matchingFiles.has(r.filePath));
}

/**
 * Get counts of symbols by kind for a project (useful for autocomplete/suggestions).
 */
export function getSymbolKindCounts(projectName: string): Record<string, number> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT kind, COUNT(*) as cnt FROM symbols
    WHERE project_name = ?
    GROUP BY kind ORDER BY cnt DESC
  `).all(projectName) as Array<{ kind: string; cnt: number }>;

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.kind] = row.cnt;
  }

  // Add export count
  const exportRow = db.prepare(`
    SELECT COUNT(*) as cnt FROM symbols WHERE project_name = ? AND exported = 1
  `).get(projectName) as { cnt: number };
  if (exportRow.cnt > 0) {
    counts['export'] = exportRow.cnt;
  }

  return counts;
}
