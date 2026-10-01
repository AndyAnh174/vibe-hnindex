import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

export type EmbeddingProvider = 'ollama' | 'openai' | 'voyage' | 'gemini' | 'openai-compatible';
const provider = (process.env.EMBEDDING_PROVIDER?.trim().toLowerCase() || 'ollama') as EmbeddingProvider;
if (!['ollama', 'openai', 'voyage', 'gemini', 'openai-compatible'].includes(provider)) {
  throw new Error('Invalid EMBEDDING_PROVIDER. Use ollama, openai, voyage, gemini, or openai-compatible.');
}
const defaults = {
  ollama: { model: process.env.OLLAMA_MODEL || 'bge-m3:567m', dimensions: 1024, url: process.env.OLLAMA_URL || 'http://localhost:11434', key: '' },
  openai: { model: 'text-embedding-3-small', dimensions: 1536, url: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', key: process.env.OPENAI_API_KEY },
  voyage: { model: 'voyage-code-3', dimensions: 1024, url: process.env.VOYAGE_BASE_URL || 'https://api.voyageai.com/v1', key: process.env.VOYAGE_API_KEY },
  gemini: { model: 'gemini-embedding-2', dimensions: 3072, url: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta', key: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY },
  'openai-compatible': { model: '', dimensions: 1024, url: '', key: process.env.OPENAI_API_KEY },
}[provider];

function embeddingInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return n;
}

function parseEmbeddingDimensions(): number {
  const raw = process.env.EMBEDDING_DIMENSIONS?.trim();
  if (raw === undefined || raw === '') return defaults.dimensions;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 16384) {
    throw new Error('EMBEDDING_DIMENSIONS must be an integer between 1 and 16384.');
  }
  if (!Number.isInteger(n)) throw new Error('EMBEDDING_DIMENSIONS must be an integer.');
  return n;
}

export const config = {
  // Embedding provider (legacy OLLAMA_* variables remain supported)
  embeddingProvider: provider,
  embeddingBaseUrl: (process.env.EMBEDDING_BASE_URL?.trim() || defaults.url).replace(/\/+$/, ''),
  embeddingApiKey: process.env.EMBEDDING_API_KEY?.trim() || defaults.key?.trim() || '',
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  embeddingModel: provider === 'gemini' ? (process.env.EMBEDDING_MODEL?.trim() || defaults.model).replace(/^models\//, '') : process.env.EMBEDDING_MODEL?.trim() || defaults.model,
  /** Must match provider output and Qdrant collection size. Re-index after changing the model. */
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
  embeddingBatchSize: embeddingInteger('EMBEDDING_BATCH_SIZE', 32, 1, 128),
  embeddingTimeoutMs: embeddingInteger('EMBEDDING_TIMEOUT_MS', embeddingInteger('OLLAMA_TIMEOUT_MS', 30000, 0, 3600000), 0, 3600000),
  embeddingMaxRetries: embeddingInteger('EMBEDDING_MAX_RETRIES', 2, 0, 5),

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

  // Streaming search (v0.9.0)
  /** Enable streaming search by default — parallel keyword+semantic, progress notifications. Default false (opt-in via stream:true or this env). */
  searchStreamEnabled: process.env.SEARCH_STREAM_ENABLED === 'true',

  // Code Agent (v0.11.0)
  /** Enable code_session and code_apply tools. Default false (opt-in). */
  codeAgentEnabled: process.env.CODE_AGENT_ENABLED === 'true',
  /** Scope: safe (read-only), moderate (create + modify non-critical files), full (all files). Default moderate. */
  codeAgentScope: (process.env.CODE_AGENT_SCOPE?.trim() || 'moderate') as 'safe' | 'moderate' | 'full',

  // Chat Memory (v0.12.0)
  /** Enable chat memory (auto-track, save/load/ingest). Default false (opt-in). */
  chatMemoryEnabled: process.env.CHAT_MEMORY_ENABLED === 'true',
  /** Max entries to load in a single chat_context load. Default 20. */
  chatMemoryLoadLimit: parseInt(process.env.CHAT_MEMORY_LOAD_LIMIT || '20', 10),
  /** Max age in hours for context retrieval. Default 168 (7 days). */
  chatMemoryMaxAgeHours: parseInt(process.env.CHAT_MEMORY_MAX_AGE_HOURS || '168', 10),
  /** Thread TTL in ms — new messages go to latest thread if within this window. Default 3600000 (1 hour). */
  chatMemoryThreadTtlMs: parseInt(process.env.CHAT_MEMORY_THREAD_TTL_MS || '3600000', 10),
  /** Enable Qdrant vector storage for chat context (semantic search). Default true when CHAT_MEMORY_ENABLED=true. */
  chatMemoryVectorEnabled: process.env.CHAT_MEMORY_VECTOR_ENABLED !== 'false',

  // Watch persistence (v0.11.4)
  /** Auto-resume file watching for all indexed projects on server start. Default true. */
  watchAutoResume: process.env.WATCH_AUTO_RESUME !== 'false',

  // Smart Context
  /** Max characters per file in smart_context output. Default 25000. Set to 0 for unlimited. */
  smartContextMaxFileChars: parseInt(process.env.SMART_CONTEXT_MAX_FILE_CHARS || '25000', 10),
} as const;

export function getCollectionName(projectName: string): string {
  const sanitized = projectName.replace(/[^a-zA-Z0-9_]/g, '_');
  return `${config.qdrantCollectionPrefix}${sanitized}${getEmbeddingNamespace()}`;
}

/** Keep the historical default Ollama collection; isolate every other vector space. */
export function getEmbeddingNamespace(): string {
  if (config.embeddingProvider === 'ollama' && config.embeddingModel === 'bge-m3:567m' && config.embeddingDimensions === 1024 && config.embeddingBaseUrl === 'http://localhost:11434') return '';
  const identity = [config.embeddingProvider, config.embeddingBaseUrl, config.embeddingModel, config.embeddingDimensions];
  return `_${createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 12)}`;
}

export function getEmbeddingProfile(): string {
  return getEmbeddingNamespace() || 'legacy-ollama';
}
