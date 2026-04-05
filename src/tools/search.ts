import { config } from '../config.js';
import type { SearchResult } from '../types.js';
import { searchKeyword, getChunksByIds, getProject, getAdjacentChunks } from '../services/sqlite.js';
import { searchSimilar, healthCheck as qdrantHealthCheck } from '../services/qdrant.js';
import { embedSingle, healthCheck as ollamaHealthCheck } from '../services/embeddings.js';

type SearchMode = 'keyword' | 'semantic' | 'hybrid';

interface SearchFilters {
  language?: string;
  file_pattern?: string;
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
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const mode = args.mode || 'hybrid';
  const limit = args.limit || 10;
  const candidateLimit = 20; // fetch more candidates for RRF
  const expandContext = args.expand_context || 0;

  const filters: SearchFilters = {};
  if (args.language) filters.language = args.language;
  if (args.file_pattern) filters.file_pattern = args.file_pattern;

  // Validate project
  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [{
        type: 'text',
        text: `Error: Project "${args.project_name}" not found. Run index_codebase first.`,
      }],
    };
  }

  let keywordResults: SearchResult[] = [];
  let semanticResults: Array<{ id: string; score: number }> = [];
  let warnings: string[] = [];
  let actualMode = mode;

  // Keyword search
  if (mode === 'keyword' || mode === 'hybrid') {
    try {
      keywordResults = searchKeyword(args.query, args.project_name, candidateLimit, filters);
    } catch (error) {
      console.error('[search] Keyword search error:', error);
      warnings.push('Keyword search failed.');
    }
  }

  // Semantic search
  if (mode === 'semantic' || mode === 'hybrid') {
    const ollamaOk = await ollamaHealthCheck();
    const qdrantOk = await qdrantHealthCheck();

    if (!ollamaOk) {
      warnings.push(`Ollama not available at ${config.ollamaUrl}. Semantic search disabled.`);
      if (mode === 'hybrid') {
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
      if (mode === 'hybrid') {
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
        semanticResults = await searchSimilar(args.project_name, queryVector, candidateLimit, filters);
      } catch (error) {
        console.error('[search] Semantic search error:', error);
        warnings.push('Semantic search failed.');
        if (mode === 'hybrid') actualMode = 'keyword';
      }
    }
  }

  // Combine results
  let finalResults: SearchResult[];

  if (actualMode === 'keyword') {
    finalResults = keywordResults.slice(0, limit);
  } else if (actualMode === 'semantic') {
    // Fetch full chunk data from SQLite
    const ids = semanticResults.slice(0, limit).map(r => r.id);
    const chunks = getChunksByIds(ids);
    const scoreMap = new Map(semanticResults.map(r => [r.id, r.score]));
    finalResults = chunks.map(c => ({
      ...c,
      score: scoreMap.get(c.id) || 0,
      matchType: 'semantic' as const,
    }));
    finalResults.sort((a, b) => b.score - a.score);
  } else {
    // Hybrid: RRF fusion
    const rrfScores = rrfFuse(keywordResults, semanticResults);
    const sorted = [...rrfScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

    // Build result map from keyword results
    const resultMap = new Map<string, SearchResult>();
    for (const r of keywordResults) {
      resultMap.set(r.id, r);
    }

    // Fetch any missing chunks (from semantic-only results)
    const missingIds = sorted.filter(([id]) => !resultMap.has(id)).map(([id]) => id);
    if (missingIds.length > 0) {
      const missingChunks = getChunksByIds(missingIds);
      for (const c of missingChunks) {
        resultMap.set(c.id, c);
      }
    }

    finalResults = sorted
      .reduce<SearchResult[]>((acc, [id, score]) => {
        const chunk = resultMap.get(id);
        if (chunk) {
          acc.push({ ...chunk, score, matchType: 'hybrid' });
        }
        return acc;
      }, []);
  }

  // Format output
  if (finalResults.length === 0) {
    const text = warnings.length > 0
      ? `No results found for "${args.query}" in project "${args.project_name}".\n\n${warnings.join('\n')}`
      : `No results found for "${args.query}" in project "${args.project_name}".`;
    return { content: [{ type: 'text', text }] };
  }

  // Build filter info string
  const filterParts: string[] = [];
  if (args.language) filterParts.push(`language: ${args.language}`);
  if (args.file_pattern) filterParts.push(`path: ${args.file_pattern}`);
  const filterInfo = filterParts.length > 0 ? ` [filters: ${filterParts.join(', ')}]` : '';

  const header = `Found ${finalResults.length} results for "${args.query}" (mode: ${actualMode})${filterInfo}:\n`;
  const warningText = warnings.length > 0 ? `\n⚠ ${warnings.join('\n⚠ ')}\n` : '';

  const resultTexts = finalResults.map((r, i) => {
    // Context expansion
    if (expandContext > 0) {
      const expanded = getAdjacentChunks(
        args.project_name, r.filePath, r.chunkIndex, expandContext, expandContext
      );
      const mergedContent = expanded.map(c => c.content).join('\n');
      const startLine = expanded[0]?.startLine ?? r.startLine;
      const endLine = expanded[expanded.length - 1]?.endLine ?? r.endLine;

      return [
        `### ${i + 1}. ${r.filePath}:${startLine}-${endLine} (${r.language}) [score: ${r.score.toFixed(4)}]`,
        '```' + r.language,
        mergedContent,
        '```',
      ].join('\n');
    }

    return [
      `### ${i + 1}. ${r.filePath}:${r.startLine}-${r.endLine} (${r.language}) [score: ${r.score.toFixed(4)}]`,
      '```' + r.language,
      r.content,
      '```',
    ].join('\n');
  });

  return {
    content: [{ type: 'text', text: header + warningText + '\n' + resultTexts.join('\n\n') }],
  };
}
