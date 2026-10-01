import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SearchResult } from '../src/types.js';
const state = vi.hoisted(() => ({ fetch: vi.fn() }));
const chunks: SearchResult[] = ['a', 'b', 'c', 'd'].map((id, index) => ({ id, filePath: `${id}.ts`, absolutePath: `/${id}.ts`,
  chunkIndex: 0, startLine: 1, endLine: 1, content: id === 'd' ? 'preferredCandidate' : `candidate-${id}`,
  language: 'typescript', score: 10 - index, matchType: 'keyword' }));
vi.mock('../src/services/sqlite.js', async importOriginal => ({
  ...await importOriginal<typeof import('../src/services/sqlite.js')>(),
  getProjectWithRetry: async () => ({ projectName: 'p', rootPath: '/repo' }),
  searchKeyword: () => chunks.map(chunk => ({ ...chunk })),
  getChunksByIds: (ids: string[]) => chunks.filter(chunk => ids.includes(chunk.id)).map(chunk => ({ ...chunk })),
}));
vi.mock('../src/services/qdrant.js', () => ({ healthCheck: async () => true,
  searchSimilar: async () => [{ id: 'd', score: .99 }, { id: 'c', score: .98 }, { id: 'a', score: .1 }, { id: 'b', score: .09 }] }));
vi.mock('../src/services/embeddings.js', () => ({ healthCheck: async () => true, embedSingle: async () => [1], embeddingUnavailableMessage: () => 'unavailable' }));
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('RERANK_URL', 'http://rerank.invalid'); vi.stubEnv('RERANK_PROVIDER', 'http');
  vi.stubEnv('SEARCH_STREAM_ENABLED', 'false'); vi.stubEnv('CHAT_MEMORY_ENABLED', 'false');
  vi.stubEnv('SEARCH_FUZZY_ENABLED', 'false');
  state.fetch = vi.fn(async (_url, options) => ({ ok: true, json: async () => ({ scores:
    JSON.parse(options.body).documents.map((document: string) => document.includes('preferredCandidate') ? 1 : 0) }) }));
  vi.stubGlobal('fetch', state.fetch);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('hybrid rank pipeline', () => {
  it.each([true, false])('reranks a wider pool before limit with dedupe=%s', async dedupe_by_file => {
    const { search } = await import('../src/tools/search.js');
    const first = await search({ project_name: 'p', query: 'candidate', mode: 'hybrid', limit: 1, dedupe_by_file });
    expect(first.content[0].text).toContain('1. d.ts:');
    expect(JSON.parse(state.fetch.mock.calls[0][1].body).documents).toHaveLength(4);
    const cached = await search({ project_name: 'p', query: 'candidate', mode: 'hybrid', limit: 1, dedupe_by_file });
    expect(cached.content[0].text).toContain('1. d.ts:');
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });
  it('keeps RRF order after failed rerank and separates rerank cache entries', async () => {
    const { search } = await import('../src/tools/search.js');
    await search({ project_name: 'p', query: 'candidate', mode: 'hybrid', limit: 1 });
    const raw = await search({ project_name: 'p', query: 'candidate', mode: 'hybrid', limit: 1, rerank: false });
    expect(raw.content[0].text).toContain('1. a.ts:');
    state.fetch.mockRejectedValue(new Error('Unavailable'));
    const fallback = await search({ project_name: 'p', query: 'another candidate', mode: 'hybrid', limit: 1 });
    expect(fallback.content[0].text).toContain('1. a.ts:');
  });
});
