/** Default MCP server label in JSON */
export const DEFAULT_SERVER_NAME = 'vibe-hnindex';

/** npx-based server block (matches docs) */
export function defaultServerBlock(env: Record<string, string>) {
  return {
    command: 'npx',
    args: ['-y', 'vibe-hnindex'],
    env,
  };
}

export function defaultEnv(options: {
  ollamaUrl: string;
  ollamaModel: string;
  qdrantUrl: string;
  qdrantApiKey?: string;
  embeddingDimensions?: number;
}): Record<string, string> {
  const env: Record<string, string> = {
    // ── Required ──
    OLLAMA_URL: options.ollamaUrl,
    OLLAMA_MODEL: options.ollamaModel,
    QDRANT_URL: options.qdrantUrl,

    // ── Performance (v0.8.0+) ──
    INDEX_WORKERS: 'auto',
    INDEX_PARALLEL_BATCH: '8',

    // ── Search Features ──
    SEARCH_STREAM_ENABLED: 'true',
    SEARCH_FUZZY_ENABLED: 'true',
    SEARCH_AUTO_ROUTE: 'true',
    SEARCH_KEYWORD_FALLBACK_SEMANTIC: 'true',
    SEARCH_RERANK: 'true',
    SEARCH_RERANK_POOL: '50',

    // ── Cache (v0.8.0) ──
    SEARCH_CACHE_SIZE: '100',
    SEARCH_CACHE_TTL_MS: '300000',

    // ── Timeouts ──
    SEARCH_TIMEOUT_MS: '60000',
    OLLAMA_TIMEOUT_MS: '30000',
    QDRANT_TIMEOUT_MS: '15000',

    // ── Code Agent (v0.11.0) ──
    CODE_AGENT_ENABLED: 'false',
    CODE_AGENT_SCOPE: 'moderate',

    // ── Chat Memory (v0.12.0) ──
    CHAT_MEMORY_ENABLED: 'true',
    CHAT_MEMORY_VECTOR_ENABLED: 'true',
    CHAT_MEMORY_LOAD_LIMIT: '20',
    CHAT_MEMORY_MAX_AGE_HOURS: '168',
    CHAT_MEMORY_THREAD_TTL_MS: '3600000',

    // ── Smart Context ──
    SMART_CONTEXT_MAX_FILE_CHARS: '25000',
  };
  if (options.qdrantApiKey) {
    env.QDRANT_API_KEY = options.qdrantApiKey;
  }
  if (options.embeddingDimensions != null && options.embeddingDimensions > 0) {
    env.EMBEDDING_DIMENSIONS = String(options.embeddingDimensions);
  }
  return env;
}
