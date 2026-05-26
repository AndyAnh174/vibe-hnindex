/**
 * Streaming Search Orchestrator (v0.9.0)
 *
 * Runs keyword + semantic search in parallel, sends progress notifications
 * at each phase, and streams early result previews via logging messages.
 *
 * Phases:
 *   1/4 — Parallel keyword + semantic search
 *   2/4 — RRF fusion
 *   3/4 — Post-processing (dedupe, fuzzy, rerank, path quality)
 *   4/4 — Format & return
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SearchResult } from '../types.js';
import { config } from '../config.js';
import { searchKeyword, getChunksByIds } from './sqlite.js';
import { searchSimilar, healthCheck as qdrantHealthCheck } from './qdrant.js';
import { embedSingle, healthCheck as ollamaHealthCheck } from './embeddings.js';
import { tokenizeForFts, buildFtsOrQuery } from './keyword-query.js';
import { fuzzyScore } from './fuzzy.js';

export interface StreamPhase {
  phase: number;
  total: number;
  message: string;
}

export interface SearchPreviewResult {
  file: string;
  lines: string;
  score: string;
  matchType: string;
  snippet: string;
}

/**
 * Send a progress notification to the MCP client.
 */
export async function sendProgress(
  extra: { sendNotification?: (notification: { method: string; params?: Record<string, unknown> }) => Promise<void>; _meta?: { progressToken?: string | number } },
  phase: number,
  total: number,
  message: string,
): Promise<void> {
  if (!extra.sendNotification || extra._meta?.progressToken === undefined) return;
  try {
    await extra.sendNotification({
      method: 'notifications/progress',
      params: {
        progressToken: extra._meta.progressToken,
        progress: phase,
        total,
        message,
      },
    });
  } catch {
    // Progress notifications are best-effort; swallow errors
  }
}

/**
 * Send a search result preview via logging message.
 */
export async function sendSearchPreview(
  server: McpServer,
  sessionId: string | undefined,
  results: SearchResult[],
  phase: string,
): Promise<void> {
  if (!sessionId || results.length === 0) return;
  const preview: SearchPreviewResult[] = results.slice(0, 5).map((r) => ({
    file: r.filePath,
    lines: `${r.startLine}-${r.endLine}`,
    score: r.score.toFixed(4),
    matchType: r.matchType,
    snippet: r.content.slice(0, 150).replace(/\n/g, ' '),
  }));
  try {
    await server.sendLoggingMessage(
      {
        level: 'info',
        data: JSON.stringify({
          type: 'search_stream',
          phase,
          count: results.length,
          preview,
        }),
      },
      sessionId,
    );
  } catch {
    // Logging is best-effort
  }
}

/**
 * Run keyword and semantic search in parallel.
 * Returns keyword results, semantic results, and any warnings.
 */
export async function parallelSearch(
  projectName: string,
  query: string,
  keywordLimit: number,
  semanticLimit: number,
  filters: { language?: string; file_pattern?: string; symbol_kind?: string },
): Promise<{
  keywordResults: SearchResult[];
  semanticResults: Array<{ id: string; score: number }>;
  warnings: string[];
  keywordFallbackRan: boolean;
  ollamaAvailable: boolean;
  qdrantAvailable: boolean;
}> {
  const warnings: string[] = [];
  let keywordFallbackRan = false;

  // ---- Prepare keyword search promise ----
  const keywordPromise = (async (): Promise<SearchResult[]> => {
    try {
      let results = searchKeyword(query, projectName, keywordLimit, filters);
      const tokens = tokenizeForFts(query);
      if (results.length === 0 && tokens.length >= 2) {
        const orQ = buildFtsOrQuery(tokens);
        if (orQ) {
          const relaxedFetch = Math.min(400, Math.max(keywordLimit * 2, keywordLimit + 20));
          results = searchKeyword(query, projectName, relaxedFetch, filters, {
            ftsExpression: orQ,
          });
          if (results.length > 0) {
            warnings.push('Keyword fallback: relaxed OR match used.');
          }
        }
      }
      return results;
    } catch (error) {
      console.error('[streaming-search] Keyword search error:', error);
      warnings.push('Keyword search failed.');
      return [];
    }
  })();

  // ---- Prepare semantic search promise ----
  const semanticPromise = (async (): Promise<{
    results: Array<{ id: string; score: number }>;
    ollamaOk: boolean;
    qdrantOk: boolean;
  }> => {
    const ollamaOk = await ollamaHealthCheck();
    const qdrantOk = await qdrantHealthCheck();

    if (!ollamaOk || !qdrantOk) {
      if (!ollamaOk) {
        warnings.push(`Ollama not available at ${config.ollamaUrl}. Semantic search disabled.`);
      }
      if (!qdrantOk) {
        warnings.push(`Qdrant not available at ${config.qdrantUrl}. Semantic search disabled.`);
      }
      return { results: [], ollamaOk, qdrantOk };
    }

    try {
      const queryVector = await embedSingle(query);
      const results = await searchSimilar(projectName, queryVector, semanticLimit, filters);
      return { results, ollamaOk, qdrantOk };
    } catch (error) {
      console.error('[streaming-search] Semantic search error:', error);
      warnings.push('Semantic search failed.');
      return { results: [], ollamaOk, qdrantOk };
    }
  })();

  // ---- Run in parallel ----
  const [keywordResults, semanticResult] = await Promise.all([keywordPromise, semanticPromise]);

  // Handle keyword fallback to semantic
  if (keywordResults.length === 0 && config.searchKeywordFallbackSemantic && semanticResult.ollamaOk && semanticResult.qdrantOk && semanticResult.results.length > 0) {
    keywordFallbackRan = true;
    warnings.push('Keyword had no hits; semantic fallback used.');
  }

  return {
    keywordResults,
    semanticResults: semanticResult.results,
    warnings,
    keywordFallbackRan,
    ollamaAvailable: semanticResult.ollamaOk,
    qdrantAvailable: semanticResult.qdrantOk,
  };
}

/**
 * Apply fuzzy re-ranking boost to search results.
 */
export function applyFuzzyBoost(
  query: string,
  results: SearchResult[],
): SearchResult[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length >= 2);

  for (const r of results) {
    const contentWords = r.content
      .toLowerCase()
      .split(/[\s,;:(){}\[\]<>"'`=+\-*/|&^%$#@!~.]+/)
      .filter((w) => w.length >= 2);

    let bestScore = 0;
    for (const qw of queryWords) {
      for (const cw of contentWords) {
        const s = fuzzyScore(qw, cw);
        if (s > bestScore) bestScore = s;
        if (bestScore >= 0.95) break;
      }
      if (bestScore >= 0.95) break;
    }

    const fullScore = fuzzyScore(queryLower, r.content.toLowerCase().slice(0, 200));
    bestScore = Math.max(bestScore, fullScore);
    r.score = r.score * (1 + bestScore * 0.5);
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
