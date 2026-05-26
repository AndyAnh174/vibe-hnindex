import path from 'node:path';
import os from 'node:os';

function parseEmbeddingDimensions(): number {
  const raw = process.env.EMBEDDING_DIMENSIONS?.trim();
  if (raw === undefined || raw === '') return 1024;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 16384) {
    console.warn(
      `[config] Invalid EMBEDDING_DIMENSIONS "${raw}" — must be 1–16384; using 1024`
    );
    return 1024;
  }
  return n;
}

export const config = {
  // Ollama
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  embeddingModel: process.env.OLLAMA_MODEL || 'bge-m3:567m',
  /** Must match the vector size returned by `OLLAMA_MODEL` (Qdrant collection size). Change only with a new model + re-index / new Qdrant collection. */
  embeddingDimensions: parseEmbeddingDimensions(),

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

  // Timeouts (prevents hanging when services are unresponsive)
  /** Timeout for Ollama API calls (embed, health check). Default 30s. */
  ollamaTimeoutMs: parseInt(process.env.OLLAMA_TIMEOUT_MS || '30000', 10),
  /** Timeout for Qdrant API calls. Default 15s. */
  qdrantTimeoutMs: parseInt(process.env.QDRANT_TIMEOUT_MS || '15000', 10),
  /** Overall timeout for search operations. Default 60s. */
  searchTimeoutMs: parseInt(process.env.SEARCH_TIMEOUT_MS || '60000', 10),

  // Parallel indexing (v0.8.0)
  /** Number of worker threads for parallel indexing. Default: auto (cpu count - 1, min 1). Set to 0 for single-threaded. */
  indexWorkers: process.env.INDEX_WORKERS?.trim() === '0' ? 0
    : process.env.INDEX_WORKERS?.trim() && process.env.INDEX_WORKERS?.trim() !== 'auto'
      ? parseInt(process.env.INDEX_WORKERS || '1', 10)
      : 0, // 0 means "auto" in parallel-indexer
  /** Files per worker batch during parallel indexing. Default 8. */
  indexParallelBatch: parseInt(process.env.INDEX_PARALLEL_BATCH || '8', 10),

  // Search cache (v0.8.0)
  /** Max cache entries for search results. Default 100. */
  searchCacheSize: parseInt(process.env.SEARCH_CACHE_SIZE || '100', 10),
  /** Cache TTL in milliseconds. Default 300000 (5 min). */
  searchCacheTtlMs: parseInt(process.env.SEARCH_CACHE_TTL_MS || '300000', 10),

  // Fuzzy search (v0.8.1)
  /** Enable fuzzy search re-ranking by default for all searches. Default false. */
  searchFuzzyEnabled: process.env.SEARCH_FUZZY_ENABLED === 'true',
} as const;

export function getCollectionName(projectName: string): string {
  const sanitized = projectName.replace(/[^a-zA-Z0-9_]/g, '_');
  return `${config.qdrantCollectionPrefix}${sanitized}`;
}
