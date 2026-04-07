import path from 'node:path';
import os from 'node:os';

export const config = {
  // Ollama
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  embeddingModel: process.env.OLLAMA_MODEL || 'bge-m3:567m',
  embeddingDimensions: 1024,

  // Storage (SQLite)
  storagePath: process.env.STORAGE_PATH || path.join(os.homedir(), '.vibe-hnindex'),
  get sqlitePath() {
    return path.join(this.storagePath, 'knowledge.db');
  },

  // Qdrant (set QDRANT_API_KEY for Qdrant Cloud / authenticated clusters)
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  qdrantApiKey: process.env.QDRANT_API_KEY?.trim() || undefined,
  qdrantCollectionPrefix: process.env.QDRANT_COLLECTION_PREFIX || 'mcp_ck_',

  // Chunking
  chunkSize: parseInt(process.env.CHUNK_SIZE || '60', 10),
  chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '5', 10),

  // Indexing
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '1048576', 10), // 1MB

  // Embedding batching
  embeddingBatchSize: 32,

  // Search (v0.4.0)
  /** When true and `mode` is omitted, behave like `mode: auto` (heuristic keyword/hybrid). */
  searchAutoRoute: process.env.SEARCH_AUTO_ROUTE === 'true',
  /** When keyword mode returns no hits, run semantic once if Ollama+Qdrant are OK. */
  searchKeywordFallbackSemantic: process.env.SEARCH_KEYWORD_FALLBACK_SEMANTIC !== 'false',

  /** Rerank top results after hybrid/semantic path scoring (HTTP and/or semantic reorder). */
  searchRerankEnabled: process.env.SEARCH_RERANK !== 'false',
  /** Max distinct files before rerank trim (then cut to `limit`). */
  searchRerankPool: parseInt(process.env.SEARCH_RERANK_POOL || '50', 10),
  /** POST JSON `{ query, documents }` → `{ scores: number[] }`. Same length as documents. */
  rerankUrl: process.env.RERANK_URL?.trim() || '',
  rerankTimeoutMs: parseInt(process.env.RERANK_TIMEOUT_MS || '15000', 10),
} as const;

export function getCollectionName(projectName: string): string {
  const sanitized = projectName.replace(/[^a-zA-Z0-9_]/g, '_');
  return `${config.qdrantCollectionPrefix}${sanitized}`;
}
