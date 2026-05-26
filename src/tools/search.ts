import { config } from '../config.js';
import type { SearchResult } from '../types.js';
import {
  searchKeyword,
  getChunksByIds,
  getProjectWithRetry,
  getAdjacentChunks,
  searchSymbolsByName,
  findChunkIdForLine,
} from '../services/sqlite.js';
import { rerankSearchResults } from '../services/rerank.js';
import { searchSimilar, healthCheck as qdrantHealthCheck } from '../services/qdrant.js';
import { embedSingle, healthCheck as ollamaHealthCheck } from '../services/embeddings.js';
import { tokenizeForFts, buildFtsOrQuery } from '../services/keyword-query.js';
import { applyPathQualityScores, deprioritizeMultiplier } from '../services/path-quality.js';
import {
  DEFAULT_MAX_CONTENT_CHARS,
  truncateContentUnicode,
} from '../services/snippet.js';
import { resolveSearchMode } from '../services/query-router.js';

type SearchMode = 'keyword' | 'semantic' | 'hybrid' | 'auto' | 'symbol';
type ContentMode = 'full' | 'compact';

interface SearchFilters {
  language?: string;
  file_pattern?: string;
}

interface HybridExplainMeta {
  rrfScore: number;
  keywordRank?: number;
  semanticRank?: number;
  semanticRawScore?: number;
}

/** Keep the highest-scoring chunk per file path (first wins if scores tie). */
function dedupeByFile(results: SearchResult[], limit: number): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    if (seen.has(r.filePath)) continue;
    seen.add(r.filePath);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

function keywordFetchLimit(limit: number, dedupe: boolean): number {
  if (!dedupe) return Math.max(20, limit);
  return Math.min(300, Math.max(40, limit * 25));
}

/** Wrap a promise with a timeout. Rejects with a TimeoutError if the promise doesn't settle in time. */
class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(ms)), ms)
    ),
  ]);
}

// Reciprocal Rank Fusion
function rrfFuse(
  keywordResults: SearchResult[],
  semanticResults: Array<{ id: string; score: number }>,
  k: number = 60
): Map<string, number> {
  const scores = new Map<string, number>();

  keywordResults.forEach((r, i) => {
    scores.set(r.id, (scores.get(r.id) || 0) + 1 / (k + i + 1));
  });

  semanticResults.forEach((r, i) => {
    scores.set(r.id, (scores.get(r.id) || 0) + 1 / (k + i + 1));
  });

  return scores;
}

export async function search(args: {
  query: string;
  project_name: string;
  mode?: SearchMode;
  limit?: number;
  language?: string;
  file_pattern?: string;
  expand_context?: number;
  dedupe_by_file?: boolean;
  content_mode?: ContentMode;
  max_content_chars?: number;
  deprioritize_generated_paths?: boolean;
  explain?: boolean;
  /** When false, skip rerank / semantic reorder. Default: enabled when SEARCH_RERANK is not false. */
  rerank?: boolean;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const rawMode =
    args.mode !== undefined ? args.mode : config.searchAutoRoute ? 'auto' : 'hybrid';
  const effectiveMode: SearchMode =
    rawMode === 'symbol' ? 'symbol' : resolveSearchMode(args.query, rawMode);
  const limit = args.limit || 10;
  const dedupeByFileEnabled = args.dedupe_by_file !== false;
  const kwLimit = keywordFetchLimit(limit, dedupeByFileEnabled);
  const candidateLimit = 20; // fetch more candidates for RRF
  const expandContext = args.expand_context || 0;
  const contentMode: ContentMode = args.content_mode === 'full' ? 'full' : 'compact';
  const maxContentChars = args.max_content_chars ?? DEFAULT_MAX_CONTENT_CHARS;
  const deprioritizePaths = args.deprioritize_generated_paths !== false;
  const explain = args.explain === true;
  const useRerank = args.rerank !== false && config.searchRerankEnabled;
  const poolCap = useRerank
    ? Math.min(config.searchRerankPool, Math.max(limit, Math.min(50, limit * 5)))
    : limit;
  const dedupeTarget = useRerank ? poolCap : limit;

  const filters: SearchFilters = {};
  if (args.language) filters.language = args.language;
  if (args.file_pattern) filters.file_pattern = args.file_pattern;

  const project = await getProjectWithRetry(args.project_name);
  if (!project) {
    return {
      content: [{
        type: 'text',
        text: `Error: Project "${args.project_name}" not found. Run index_codebase first.`,
      }],
    };
  }

  try {
    const result = await withTimeout((async (): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {

  let keywordResults: SearchResult[] = [];
  let semanticResults: Array<{ id: string; score: number }> = [];
  const warnings: string[] = [];
  let actualMode = effectiveMode;

  const semanticFetchLimit = dedupeByFileEnabled
    ? Math.min(200, Math.max(limit * 20, limit))
    : limit;

  let keywordFallbackRan = false;

  // Keyword / semantic / hybrid (symbol mode uses SQLite symbols table only)
  if (effectiveMode !== 'symbol') {
  // Keyword search (fetch more rows when deduping by file so we can still fill `limit` distinct files)
  if (effectiveMode === 'keyword' || effectiveMode === 'hybrid') {
    try {
      const kwFetch = effectiveMode === 'keyword' ? kwLimit : Math.max(candidateLimit, kwLimit);
      keywordResults = searchKeyword(args.query, args.project_name, kwFetch, filters);

      const tokens = tokenizeForFts(args.query);
      if (keywordResults.length === 0 && tokens.length >= 2) {
        const orQ = buildFtsOrQuery(tokens);
        if (orQ) {
          const relaxedFetch = Math.min(400, Math.max(kwFetch * 2, kwFetch + 20));
          keywordResults = searchKeyword(args.query, args.project_name, relaxedFetch, filters, {
            ftsExpression: orQ,
          });
          if (keywordResults.length > 0) {
            warnings.push('Keyword fallback: relaxed OR match used.');
          }
        }
      }
    } catch (error) {
      console.error('[search] Keyword search error:', error);
      warnings.push('Keyword search failed.');
    }
  }

  if (
    effectiveMode === 'keyword' &&
    keywordResults.length === 0 &&
    config.searchKeywordFallbackSemantic
  ) {
    const ollamaOk = await ollamaHealthCheck();
    const qdrantOk = await qdrantHealthCheck();
    if (ollamaOk && qdrantOk) {
      try {
        const queryVector = await embedSingle(args.query);
        semanticResults = await searchSimilar(
          args.project_name,
          queryVector,
          semanticFetchLimit,
          filters
        );
        keywordFallbackRan = true;
        if (semanticResults.length > 0) {
          warnings.push('Keyword had no hits; semantic fallback used.');
        }
      } catch (error) {
        console.error('[search] Keyword→semantic fallback error:', error);
        warnings.push('Semantic fallback after keyword failed.');
      }
    }
  }

  // Semantic search (skip if keyword fallback already populated semanticResults)
  if ((effectiveMode === 'semantic' || effectiveMode === 'hybrid') && !keywordFallbackRan) {
    const ollamaOk = await ollamaHealthCheck();
    const qdrantOk = await qdrantHealthCheck();

    if (!ollamaOk) {
      warnings.push(`Ollama not available at ${config.ollamaUrl}. Semantic search disabled.`);
      if (effectiveMode === 'hybrid') {
        actualMode = 'keyword';
      } else {
        return {
          content: [{
            type: 'text',
            text: `Error: Ollama not running at ${config.ollamaUrl}. Run: ollama serve && ollama pull ${config.embeddingModel}`,
          }],
        };
      }
    } else if (!qdrantOk) {
      warnings.push(`Qdrant not available at ${config.qdrantUrl}. Semantic search disabled.`);
      if (effectiveMode === 'hybrid') {
        actualMode = 'keyword';
      } else {
        return {
          content: [{
            type: 'text',
            text: `Error: Qdrant not running at ${config.qdrantUrl}. Run: docker run -d -p 6333:6333 qdrant/qdrant`,
          }],
        };
      }
    } else {
      try {
        const queryVector = await embedSingle(args.query);
        const semLimit =
          effectiveMode === 'hybrid' ? Math.max(candidateLimit, semanticFetchLimit) : semanticFetchLimit;
        semanticResults = await searchSimilar(args.project_name, queryVector, semLimit, filters);
      } catch (error) {
        console.error('[search] Semantic search error:', error);
        warnings.push('Semantic search failed.');
        if (effectiveMode === 'hybrid') actualMode = 'keyword';
      }
    }
  }
  } // end effectiveMode !== 'symbol'

  // Combine results
  let finalResults: SearchResult[];
  const hybridExplainById = new Map<string, HybridExplainMeta>();
  const semanticRawById = new Map(semanticResults.map((r) => [r.id, r.score]));
  const keywordRankById = new Map(keywordResults.map((r, i) => [r.id, i + 1]));
  const semanticRankById = new Map(semanticResults.map((r, i) => [r.id, i + 1]));

  if (effectiveMode === 'symbol') {
    const nameQ = args.query.trim();
    if (!nameQ) {
      return {
        content: [{
          type: 'text',
          text: 'Error: mode "symbol" requires a non-empty query (symbol / identifier name).',
        }],
      };
    }
    let symbols = searchSymbolsByName(args.project_name, nameQ, {
      filePattern: args.file_pattern,
      limit: 200,
    });
    if (args.language) {
      const lang = args.language.toLowerCase();
      symbols = symbols.filter((s) => s.language.toLowerCase() === lang);
    }
    const seenFiles = new Set<string>();
    const built: SearchResult[] = [];
    let rank = 0;
    for (const sym of symbols) {
      const cid = findChunkIdForLine(args.project_name, sym.filePath, sym.lineNumber);
      if (!cid) continue;
      if (dedupeByFileEnabled) {
        if (seenFiles.has(sym.filePath)) continue;
        seenFiles.add(sym.filePath);
      }
      const chunks = getChunksByIds([cid]);
      const c = chunks[0];
      if (!c) continue;
      rank += 1;
      built.push({
        ...c,
        score: 1 / rank,
        matchType: 'symbol',
      });
      if (built.length >= poolCap) break;
    }
    finalResults = dedupeByFileEnabled ? built : built.slice(0, limit);
  } else if (keywordFallbackRan && semanticResults.length > 0) {
    actualMode = 'semantic';
    const ids = semanticResults.slice(0, semanticFetchLimit).map((r) => r.id);
    const chunks = getChunksByIds(ids);
    const scoreMap = new Map(semanticResults.map((r) => [r.id, r.score]));
    finalResults = chunks.map((c) => ({
      ...c,
      score: scoreMap.get(c.id) || 0,
      matchType: 'semantic' as const,
    }));
    finalResults.sort((a, b) => b.score - a.score);
    if (dedupeByFileEnabled) {
      finalResults = dedupeByFile(finalResults, dedupeTarget);
    } else {
      finalResults = finalResults.slice(0, dedupeTarget);
    }
  } else if (actualMode === 'keyword') {
    const ranked = dedupeByFileEnabled
      ? dedupeByFile(keywordResults, dedupeTarget)
      : keywordResults.slice(0, dedupeTarget);
    finalResults = ranked;
  } else if (actualMode === 'semantic') {
    const ids = semanticResults.slice(0, semanticFetchLimit).map((r) => r.id);
    const chunks = getChunksByIds(ids);
    const scoreMap = new Map(semanticResults.map((r) => [r.id, r.score]));
    finalResults = chunks.map((c) => ({
      ...c,
      score: scoreMap.get(c.id) || 0,
      matchType: 'semantic' as const,
    }));
    finalResults.sort((a, b) => b.score - a.score);
    if (dedupeByFileEnabled) {
      finalResults = dedupeByFile(finalResults, dedupeTarget);
    } else {
      finalResults = finalResults.slice(0, dedupeTarget);
    }
  } else {
    // Hybrid: RRF fusion
    const rrfScores = rrfFuse(keywordResults, semanticResults);
    const hybridPool = dedupeByFileEnabled ? kwLimit : limit;
    const sorted = [...rrfScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, hybridPool);

    const resultMap = new Map<string, SearchResult>();
    for (const r of keywordResults) {
      resultMap.set(r.id, r);
    }

    const missingIds = sorted.filter(([id]) => !resultMap.has(id)).map(([id]) => id);
    if (missingIds.length > 0) {
      const missingChunks = getChunksByIds(missingIds);
      for (const c of missingChunks) {
        resultMap.set(c.id, c);
      }
    }

    for (const [id, rrfScore] of rrfScores) {
      hybridExplainById.set(id, {
        rrfScore,
        keywordRank: keywordRankById.get(id),
        semanticRank: semanticRankById.get(id),
        semanticRawScore: semanticRawById.get(id),
      });
    }

    finalResults = sorted.reduce<SearchResult[]>((acc, [id, score]) => {
      const chunk = resultMap.get(id);
      if (chunk) {
        acc.push({ ...chunk, score, matchType: 'hybrid' });
      }
      return acc;
    }, []);
    if (dedupeByFileEnabled) {
      finalResults = dedupeByFile(finalResults, dedupeTarget);
    } else {
      finalResults = finalResults.slice(0, dedupeTarget);
    }
  }

  const scoreBeforePath = new Map(finalResults.map((r) => [r.id, r.score]));
  const pathMulById = new Map(finalResults.map((r) => [r.id, deprioritizeMultiplier(r.filePath)]));

  finalResults = applyPathQualityScores(finalResults, deprioritizePaths);

  if (useRerank) {
    finalResults = await rerankSearchResults(args.query, finalResults, semanticRawById);
  }
  finalResults = finalResults.slice(0, limit);

  // Format output
  if (finalResults.length === 0) {
    const text = warnings.length > 0
      ? `No results found for "${args.query}" in project "${args.project_name}".\n\n${warnings.join('\n')}`
      : `No results found for "${args.query}" in project "${args.project_name}".`;
    return { content: [{ type: 'text', text }] };
  }

  const filterParts: string[] = [];
  if (args.language) filterParts.push(`language: ${args.language}`);
  if (args.file_pattern) filterParts.push(`path: ${args.file_pattern}`);
  if (contentMode === 'compact') {
    filterParts.push(`content: compact (max ~${maxContentChars} chars/chunk)`);
  }
  const filterInfo = filterParts.length > 0 ? ` [filters: ${filterParts.join(', ')}]` : '';

  const modeLabel =
    rawMode === 'auto' ? `${effectiveMode} (auto from query)` : effectiveMode;
  const header = `Found ${finalResults.length} results for "${args.query}" (mode: ${modeLabel})${filterInfo}:\n`;
  const warningText = warnings.length > 0 ? `\n⚠ ${warnings.join('\n⚠ ')}\n` : '';

  const expandCap =
    expandContext > 0
      ? Math.min(8000, Math.max(maxContentChars * 3, maxContentChars))
      : maxContentChars;

  const resultTexts = finalResults.map((r, i) => {
    const formatBody = (raw: string) => {
      if (contentMode === 'full') return raw;
      const cap = expandContext > 0 ? expandCap : maxContentChars;
      return truncateContentUnicode(raw, cap);
    };

    let explainLine = '';
    if (explain) {
      const before = scoreBeforePath.get(r.id) ?? r.score;
      const mul = pathMulById.get(r.id) ?? 1;
      const parts: string[] = [
        `score_before_path=${before.toFixed(6)}`,
        `path_multiplier=${mul}`,
        `final_score=${r.score.toFixed(6)}`,
        `match=${r.matchType}`,
      ];
      if (r.matchType === 'semantic') {
        parts.push(`semantic_raw=${(semanticRawById.get(r.id) ?? before).toFixed(6)}`);
      }
      if (r.matchType === 'hybrid') {
        const h = hybridExplainById.get(r.id);
        if (h) {
          parts.push(`rrf=${h.rrfScore.toFixed(6)}`);
          if (h.keywordRank !== undefined) parts.push(`keyword_rank=${h.keywordRank}`);
          if (h.semanticRank !== undefined) parts.push(`semantic_rank=${h.semanticRank}`);
          if (h.semanticRawScore !== undefined) {
            parts.push(`semantic_raw=${h.semanticRawScore.toFixed(6)}`);
          }
        }
      }
      if (r.matchType === 'symbol') {
        parts.push('source=symbols_table');
      }
      explainLine = `\nexplain: ${parts.join(' ')}`;
    }

    if (expandContext > 0) {
      const expanded = getAdjacentChunks(
        args.project_name, r.filePath, r.chunkIndex, expandContext, expandContext
      );
      const mergedContent = expanded.map((c) => c.content).join('\n');
      const startLine = expanded[0]?.startLine ?? r.startLine;
      const endLine = expanded[expanded.length - 1]?.endLine ?? r.endLine;

      return [
        `### ${i + 1}. ${r.filePath}:${startLine}-${endLine} (${r.language}) [score: ${r.score.toFixed(4)}]`,
        '```' + r.language,
        formatBody(mergedContent),
        '```',
        explainLine,
      ].filter(Boolean).join('\n');
    }

    return [
      `### ${i + 1}. ${r.filePath}:${r.startLine}-${r.endLine} (${r.language}) [score: ${r.score.toFixed(4)}]`,
      '```' + r.language,
      formatBody(r.content),
      '```',
      explainLine,
    ].filter(Boolean).join('\n');
  });

  return {
    content: [{ type: 'text', text: header + warningText + '\n' + resultTexts.join('\n\n') }],
  };

    })(), config.searchTimeoutMs);
    return result;
  } catch (error) {
    if (error instanceof TimeoutError) {
      return {
        content: [{
          type: 'text',
          text: `Error: Search timed out after ${config.searchTimeoutMs}ms. The operation may be slow due to unresponsive services (Ollama/Qdrant). Try a simpler query or check that Ollama and Qdrant are running and healthy.`,
        }],
      };
    }
    throw error;
  }
}
