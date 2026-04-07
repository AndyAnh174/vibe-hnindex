/**
 * Optional reranker for search results.
 *
 * HTTP (set RERANK_URL): POST JSON body
 *   { "query": string, "documents": string[] }
 * Response JSON:
 *   { "scores": number[] }  // same length as documents, higher = more relevant
 *
 * If the request fails or RERANK_URL is empty, falls back to ordering by
 * semanticRawScore (Qdrant) when available.
 */
import { config } from '../config.js';
import type { SearchResult } from '../types.js';

export async function rerankSearchResults(
  query: string,
  results: SearchResult[],
  semanticRawById: Map<string, number>
): Promise<SearchResult[]> {
  if (results.length <= 1) return results;
  if (!config.searchRerankEnabled) return results;

  const url = config.rerankUrl;
  if (url) {
    try {
      const documents = results.map((r) => r.content.slice(0, 8000));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.rerankTimeoutMs);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, documents }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        console.error('[rerank] HTTP', res.status, await res.text());
        return reorderBySemantic(results, semanticRawById);
      }
      const data = (await res.json()) as { scores?: number[] };
      const scores = data.scores;
      if (!Array.isArray(scores) || scores.length !== results.length) {
        console.error('[rerank] Invalid scores array length');
        return reorderBySemantic(results, semanticRawById);
      }
      const indexed = results.map((r, i) => ({ r, s: scores[i] ?? 0 }));
      indexed.sort((a, b) => b.s - a.s);
      return indexed.map((x) => ({
        ...x.r,
        score: x.s,
      }));
    } catch (e) {
      console.error('[rerank] Request failed:', e);
      return reorderBySemantic(results, semanticRawById);
    }
  }

  return reorderBySemantic(results, semanticRawById);
}

function reorderBySemantic(
  results: SearchResult[],
  semanticRawById: Map<string, number>
): SearchResult[] {
  if (semanticRawById.size === 0) return results;
  const copy = [...results];
  copy.sort((a, b) => {
    const sa = semanticRawById.get(a.id) ?? 0;
    const sb = semanticRawById.get(b.id) ?? 0;
    return sb - sa;
  });
  return copy.map((r) => ({
    ...r,
    score: semanticRawById.get(r.id) ?? r.score,
  }));
}
