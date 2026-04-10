/**
 * Fixture for MCP search benchmarks — symbols + text for keyword/semantic/hybrid.
 */
export function parseEmbeddingDimensions(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 1024;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1024;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return texts.map(() => new Array(1024).fill(0));
}

export const QDRANT_DEFAULT_URL = 'http://localhost:6333';
