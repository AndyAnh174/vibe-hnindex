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
  });

  it('reorders by semantic scores when no HTTP URL', async () => {
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
    expect(out[0].id).toBe('b');
    expect(out[1].id).toBe('a');
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
});
