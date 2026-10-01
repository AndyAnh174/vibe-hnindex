import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { SearchResult } from '../src/types.js';

describe('rerankSearchResults', () => {
  const base: SearchResult = {
    id: 'a',
    filePath: 'x.ts',
    absolutePath: '/x.ts',
    chunkIndex: 0,
    startLine: 1,
    endLine: 10,
    content: 'one',
    language: 'typescript',
    score: 0.5,
    matchType: 'semantic',
  };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RERANK_URL;
    delete process.env.SEARCH_RERANK;
    for (const name of ['RERANK_PROVIDER', 'RERANK_API_KEY', 'RERANK_MODEL', 'RERANK_TIMEOUT_MS', 'VOYAGE_API_KEY']) delete process.env[name];
  });

  it('preserves retrieval scores and order when no reranker is configured', async () => {
    process.env.RERANK_URL = '';
    process.env.SEARCH_RERANK = 'true';
    const { rerankSearchResults } = await import('../src/services/rerank.js');
    const r0 = { ...base, id: 'a', score: 0.1 };
    const r1 = { ...base, id: 'b', content: 'two', score: 0.2 };
    const sem = new Map<string, number>([
      ['a', 0.1],
      ['b', 0.9],
    ]);
    const out = await rerankSearchResults('q', [r0, r1], sem);
    expect(out).toEqual([r0, r1]);
  });

  it('uses HTTP scores when RERANK_URL responds', async () => {
    process.env.RERANK_URL = 'http://example.invalid/rerank';
    process.env.SEARCH_RERANK = 'true';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scores: [0.2, 0.8] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { rerankSearchResults } = await import('../src/services/rerank.js');
    const r0 = { ...base, id: 'a' };
    const r1 = { ...base, id: 'b', content: 'z' };
    const out = await rerankSearchResults('q', [r0, r1], new Map());
    expect(fetchMock).toHaveBeenCalled();
    expect(out[0].id).toBe('b');
    expect(out[0].score).toBe(0.8);
  });

  it.each([{ scores: [NaN, 1] }, { scores: ['1', 2] }, { scores: [1] }])('preserves ordering for invalid scores %j', async data => {
    process.env.RERANK_URL = 'http://example.invalid/rerank';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    const { rerankSearchResults } = await import('../src/services/rerank.js');
    const input = [{ ...base, score: .9 }, { ...base, id: 'b', score: .1 }];
    expect(await rerankSearchResults('query', input, new Map([['b', 1]]))).toEqual(input);
  });

  it('maps Voyage indices and sends authenticated provider payload', async () => {
    process.env.RERANK_PROVIDER = 'voyage';
    process.env.VOYAGE_API_KEY = 'test-key';
    process.env.RERANK_MODEL = 'test-model';
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ index: 1, relevance_score: .9 }, { index: 0, relevance_score: .1 }] }) });
    vi.stubGlobal('fetch', fetch);
    const { rerankSearchResults } = await import('../src/services/rerank.js');
    expect((await rerankSearchResults('query', [base, { ...base, id: 'b' }]))[0].id).toBe('b');
    expect(fetch.mock.calls[0][0]).toBe('https://api.voyageai.com/v1/rerank');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(fetch.mock.calls[0][1].body).model).toBe('test-model');
  });

  it('does not forward embedding Voyage credentials to a custom HTTP service', async () => {
    process.env.RERANK_URL = 'http://example.invalid/rerank';
    process.env.VOYAGE_API_KEY = 'embedding-only-key';
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ scores: [.1, .9] }) });
    vi.stubGlobal('fetch', fetch);
    const { rerankSearchResults } = await import('../src/services/rerank.js');
    await rerankSearchResults('query', [base, { ...base, id: 'b' }]);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('rejects duplicate Voyage indices', async () => {
    process.env.RERANK_PROVIDER = 'voyage'; process.env.RERANK_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ index: 0, relevance_score: .9 }, { index: 0, relevance_score: .1 }] }) }));
    const { rerankSearchResults } = await import('../src/services/rerank.js');
    const input = [base, { ...base, id: 'b' }];
    expect(await rerankSearchResults('query', input)).toEqual(input);
  });

  it('keeps timeout active while reading the response body', async () => {
    process.env.RERANK_URL = 'http://example.invalid/rerank'; process.env.RERANK_TIMEOUT_MS = '10';
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => ({ ok: true, json: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }) })));
    const { rerankSearchResults } = await import('../src/services/rerank.js');
    const input = [base, { ...base, id: 'b' }];
    expect(await rerankSearchResults('query', input)).toEqual(input);
  });
});
