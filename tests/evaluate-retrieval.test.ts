import { describe, it, expect } from 'vitest';
import { scoreRetrieval } from '../src/tools/evaluate-retrieval.js';

describe('retrieval quality metrics', () => {
  it('computes partial recall, reciprocal rank and binary nDCG', () => {
    const scores = scoreRetrieval(['noise.ts', 'b.ts', 'a.ts'], ['a.ts', 'b.ts', 'c.ts'], 2);
    expect(scores.recall).toBeCloseTo(1 / 3);
    expect(scores.mrr).toBe(.5);
    expect(scores.ndcg).toBeCloseTo((1 / Math.log2(3)) / (1 + 1 / Math.log2(3)));
  });
  it('deduplicates file hits and labels, and normalizes path separators', () => {
    expect(scoreRetrieval(['src\\a.ts', 'src/a.ts', 'b.ts'], ['src/a.ts', 'src/a.ts', 'b.ts'], 2))
      .toEqual({ recall: 1, mrr: 1, ndcg: 1 });
  });
  it('returns zero for no hits', () => {
    expect(scoreRetrieval([], ['a.ts'], 5)).toEqual({ recall: 0, mrr: 0, ndcg: 0 });
  });
});
