import { search } from './search.js';
import { getProject } from '../services/sqlite.js';
import { graphTokenCount } from './code-graph.js';
import type { SearchResult } from '../types.js';

export interface RetrievalCase {
  query: string;
  expected_files: string[];
  mode?: 'keyword' | 'semantic' | 'hybrid' | 'symbol' | 'regex';
}

export function scoreRetrieval(files: string[], expectedFiles: string[], k: number) {
  const expected = new Set(expectedFiles.map(file => file.replace(/\\/g, '/')));
  const ranked = [...new Set(files.map(file => file.replace(/\\/g, '/')))].slice(0, k);
  const relevant = ranked.map(file => expected.has(file));
  const first = relevant.indexOf(true);
  const found = relevant.filter(Boolean).length;
  const dcg = relevant.reduce((sum, hit, index) => sum + (hit ? 1 / Math.log2(index + 2) : 0), 0);
  const ideal = Array.from({ length: Math.min(k, expected.size) }, (_, index) => 1 / Math.log2(index + 2)).reduce((a, b) => a + b, 0);
  return { recall: expected.size ? found / expected.size : 0, mrr: first >= 0 ? 1 / (first + 1) : 0, ndcg: ideal ? dcg / ideal : 0 };
}

export async function evaluateRetrievalTool(args: { project_name: string; cases: RetrievalCase[]; k?: number; rerank?: boolean }) {
  const error = (text: string) => ({ content: [{ type: 'text' as const, text }] });
  if (!getProject(args.project_name)) return error('Error: Project not found.');
  if (!args.cases.length || args.cases.length > 100 || args.cases.some(test => !test.query.trim() || !test.expected_files.length)) {
    return error('Error: Supply 1–100 cases with non-empty queries and expected_files.');
  }
  const k = Math.max(1, Math.min(50, args.k ?? 5));
  const rows = [];
  for (const test of args.cases) {
    let hits: SearchResult[] = [];
    const started = performance.now();
    const response = await search({ query: test.query, project_name: args.project_name,
      mode: test.mode ?? 'keyword', limit: k, dedupe_by_file: true, rerank: args.rerank }, {
      skipCache: true, onResults: results => { hits = results; },
    });
    const latencyMs = performance.now() - started;
    const text = response.content[0]?.text ?? '';
    rows.push({ query: test.query, mode: test.mode ?? 'keyword', files: hits.map(hit => hit.filePath),
      ...scoreRetrieval(hits.map(hit => hit.filePath), test.expected_files, k), latencyMs,
      outputTokens: graphTokenCount(text), error: text.startsWith('Error:') ? text : null });
  }
  const valid = rows.filter(row => !row.error);
  const average = (key: 'recall' | 'mrr' | 'ndcg' | 'outputTokens') => valid.length ? valid.reduce((sum, row) => sum + row[key], 0) / valid.length : 0;
  const times = valid.map(row => row.latencyMs).sort((a, b) => a - b);
  const report = { project: args.project_name, k, totalCases: rows.length, successfulCases: valid.length,
    recallAtK: average('recall'), mrr: average('mrr'), ndcgAtK: average('ndcg'),
    p95Ms: times.length ? times[Math.ceil(times.length * .95) - 1] : null,
    meanOutputTokens: average('outputTokens'), tokenizer: 'cl100k_base',
    cache: 'bypassed', note: 'File-level relevance, one run per case. Warm services may affect latency. Errors are excluded from quality averages and listed explicitly.', rows };
  return { content: [{ type: 'text' as const, text: JSON.stringify(report, null, 2) }] };
}
