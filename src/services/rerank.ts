/** Optional Voyage or custom HTTP reranker. Failure preserves the original ranking. */
import { config } from '../config.js';
import type { SearchResult } from '../types.js';

export async function rerankSearchResults(
  query: string, results: SearchResult[], _semanticRawById?: Map<string, number>,
): Promise<SearchResult[]> {
  if (results.length <= 1 || !config.searchRerankEnabled || config.rerankProvider === 'none') return results;
  const voyage = config.rerankProvider === 'voyage';
  if (!voyage && config.rerankProvider !== 'http') return results;
  const url = config.rerankUrl || (voyage ? 'https://api.voyageai.com/v1/rerank' : '');
  if (!url || (voyage && !config.rerankApiKey)) return results;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.rerankTimeoutMs);
  try {
    const documents = results.map(result => `File: ${result.filePath}\n${result.content.slice(0, 8000)}`);
    const response = await fetch(url, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(config.rerankApiKey ? { Authorization: `Bearer ${config.rerankApiKey}` } : {}) },
      body: JSON.stringify({ query, documents, ...(voyage ? { model: config.rerankModel, truncation: true } : {}) }),
    });
    if (!response.ok) { console.error('[rerank] HTTP status', response.status); return results; }
    const data = await response.json() as { scores?: unknown[]; data?: Array<{ index: number; relevance_score: number }> };
    let scores = data.scores;
    if (voyage) {
      if (!Array.isArray(data.data) || data.data.length !== results.length) return results;
      const indices = new Set(data.data.map(row => row.index));
      if (indices.size !== results.length || [...indices].some(index => !Number.isInteger(index) || index < 0 || index >= results.length)) return results;
      scores = new Array(results.length);
      for (const row of data.data) scores[row.index] = row.relevance_score;
    }
    if (!Array.isArray(scores) || scores.length !== results.length || scores.some(score => typeof score !== 'number' || !Number.isFinite(score))) return results;
    return results.map((result, index) => ({ ...result, score: scores![index] as number })).sort((a, b) => b.score - a.score);
  } catch {
    console.error('[rerank] Request failed; preserving retrieval order.');
    return results;
  } finally { clearTimeout(timer); }
}
