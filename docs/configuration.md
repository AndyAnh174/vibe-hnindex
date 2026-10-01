# Configuration

## Environment variables

See [Embedding providers](embedding-providers.md) for Ollama, OpenAI, Voyage, Gemini and OpenAI-compatible setup, API keys, model defaults and migration instructions.

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `bge-m3:567m` | Embedding model name |
| `EMBEDDING_PROVIDER` | `ollama` | `ollama`, `openai`, `voyage`, `gemini`, or `openai-compatible` |
| `EMBEDDING_MODEL` | Provider default | Model override; `OLLAMA_MODEL` remains the legacy fallback for Ollama |
| `EMBEDDING_BASE_URL` | Provider default | API base URL including version; required for `openai-compatible` |
| `EMBEDDING_API_KEY` | *(unset)* | Generic key override; otherwise use `OPENAI_API_KEY`, `VOYAGE_API_KEY`, or `GEMINI_API_KEY` / `GOOGLE_API_KEY` |
| `EMBEDDING_DIMENSIONS` | Provider default | Ollama/Voyage/compatible: 1024; OpenAI: 1536; Gemini: 3072. Must match model output. Re-index the entire project after changing provider/model/dimensions/endpoint. |
| `EMBEDDING_BATCH_SIZE` | `32` | Texts per batch, 1–128; Gemini uses separate requests with at most 4 concurrent requests per worker |
| `EMBEDDING_TIMEOUT_MS` | `30000` | Per-request timeout through response body parsing; falls back to `OLLAMA_TIMEOUT_MS`; `0` disables timeout |
| `EMBEDDING_MAX_RETRIES` | `2` | Extra attempts for HTTP 429/5xx; Retry-After/exponential delay capped at 10 seconds; 0–5 |
| `STORAGE_PATH` | `~/.vibe-hnindex` | SQLite database directory |
| `HNINDEX_PROJECT_ROOT` | *(unset)* | Workspace binding for context/locator/resource. CLI project installations set this automatically; global installations otherwise follow current MCP client roots. See [workspace setup](workspace.md). |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant REST URL. For **Qdrant Cloud**, use the full HTTPS URL from the cluster page (often includes `:6333`). |
| `QDRANT_API_KEY` | *(unset)* | **Required** for Qdrant Cloud and any cluster that checks the `api-key` header. Omit for local Docker with no auth. |
| `QDRANT_COLLECTION_PREFIX` | `mcp_ck_` | Prefix for Qdrant collection names |
| `CHUNK_SIZE` | `60` | Target lines per chunk |
| `CHUNK_OVERLAP` | `5` | Overlap in line-based fallback; AST chunks are non-overlapping |
| `AST_CHUNKING` | `true` | TS/JS syntax boundaries; oversized declarations still have a line cap |
| `CODE_GRAPH_ENABLED` | `true` | Enable SQLite code graph and graph MCP tools |
| `CODE_GRAPH_MAX_NODES` | `40` | Default traversal node cap, 1–100 |
| `MAX_FILE_SIZE` | `1048576` | Max file size in bytes (1 MB) |
| `INDEX_WORKERS` | `auto` | CPU count − 1 (min 1), capped at 4 for non-Ollama providers. `0` or `1` forces single-threaded. Explicit positive values override the automatic cap. |
| `INDEX_PARALLEL_BATCH` | `8` | Files per worker batch during parallel indexing. Higher = more throughput but more memory. |
| `SEARCH_AUTO_ROUTE` | `false` | When `true`, omitting `search`’s `mode` behaves like `mode: auto` (heuristic keyword vs hybrid). |
| `SEARCH_KEYWORD_FALLBACK_SEMANTIC` | `true` | When not `false`, if `mode` is keyword and FTS returns no hits, run one semantic search when the selected embedding provider and Qdrant are available. |
| `SEARCH_RERANK` | *(enabled)* | Set to `false` to disable Voyage/custom HTTP reranking. |
| `SEARCH_RERANK_POOL` | `50` | Max distinct results pulled into the rerank pool before trimming to `limit`. |
| `RERANK_PROVIDER` | `http` if URL set, else `none` | `none`, `http`, `voyage` |
| `RERANK_MODEL` | `rerank-3-lite` | Voyage model |
| `RERANK_API_KEY` | *(unset)* | Bearer key; Voyage falls back to `VOYAGE_API_KEY` |
| `RERANK_URL` | *(empty)* | If set, POST JSON `{ "query": string, "documents": string[] }`; expect JSON `{ "scores": number[] }` (same length as `documents`, higher = more relevant). |
| `RERANK_TIMEOUT_MS` | `15000` | Full request/body timeout in ms for either rerank provider. |
| `SEARCH_CACHE_SIZE` | `100` | Max cache entries for search results (LRU eviction). |
| `SEARCH_CACHE_TTL_MS` | `300000` | Cache TTL in milliseconds (5 min). Cache is skipped for `regex` mode. |
| `SEARCH_FUZZY_ENABLED` | `false` | When `true`, enable fuzzy search re-ranking for all searches by default. Can be overridden per-query with `fuzzy: true/false` tool argument. |
| `SEARCH_STREAM_ENABLED` | `false` | When `true`, enable streaming search by default for all non-regex, non-symbol searches. Runs keyword + semantic in parallel with progress notifications and early result preview via MCP logging. Can be overridden per-query with `stream: true/false` tool argument. |

### Optional rerank

Set `RERANK_PROVIDER=voyage` for the native Voyage API, or `RERANK_PROVIDER=http` with `RERANK_URL` for a custom `{query, documents}` -> `{scores}` service. The Voyage default model is `rerank-3-lite`; override with `RERANK_MODEL`. Voyage uses `RERANK_API_KEY` or `VOYAGE_API_KEY`. Custom HTTP only sends the explicitly supplied `RERANK_API_KEY`, never an embedding provider's credential.

No provider configured, invalid/non-finite scores, missing credentials, timeout or service errors preserve the original ranking. Reranking runs on a candidate pool before the final `limit`; symbol and regex modes skip it. Set `rerank:false` per search or `SEARCH_RERANK=false` globally to skip calls. `RERANK_TIMEOUT_MS` covers the response body as well as headers. Remote response bodies and credentials are not logged.

### Code Graph and AST chunking

`CODE_GRAPH_ENABLED=true` and `AST_CHUNKING=true` are defaults. `CODE_GRAPH_MAX_NODES` defaults to 40 (1–100) for traversal. Graph data stays in SQLite; graph-only indexing works without embeddings/Qdrant. Other languages retain their existing chunking and symbol behavior. See [Code Graph](code-graph.md).

After upgrading from v0.13.0, restart and run a full `index_codebase` to rebuild source chunks, symbol metadata and vectors. Changes to AST chunking, chunk size/overlap also require full re-indexing. Graph-only users can run `index_code_graph` instead. Both full scans remove deleted/excluded graph files; `index_codebase` also removes their chunks/vectors.

### Parallel indexing (v0.8.0)

`INDEX_WORKERS` controls parallel file indexing using worker threads. `auto` uses CPU count minus one (minimum 1), capped at 4 for non-Ollama providers to reduce API pressure. Set a positive number for manual control, or `0` / `1` for sequential indexing.

`INDEX_PARALLEL_BATCH` controls how many files each worker processes in one batch (default 8). Higher values increase throughput but use more memory.

**Examples:**
```bash
# Auto — use all available cores
export INDEX_WORKERS=auto
# Manual — use exactly 4 workers
export INDEX_WORKERS=4
# Single-threaded (no workers)
export INDEX_WORKERS=1
# Larger batches for better throughput
export INDEX_PARALLEL_BATCH=16
```

### Search cache (v0.8.0)

Search results are cached in-memory with LRU eviction and TTL. The cache key includes the project name, query, mode, limit, and active filters.

- **`SEARCH_CACHE_SIZE`** (default 100): maximum number of cached search results.
- **`SEARCH_CACHE_TTL_MS`** (default 300000 = 5 min): how long cached results are valid.

Cache is automatically invalidated when the project is re-indexed. Cache is bypassed for regex, expanded/explained output and labeled evaluation. It stores final ranked results; ranking, fuzzy, path and dedupe options are included in the key.

### Fuzzy search (v0.8.1)

**`SEARCH_FUZZY_ENABLED`** (default `false`): when `true`, all searches automatically apply fuzzy re-ranking after retrieval. Can be overridden per-query with the `fuzzy` tool argument.

Fuzzy search computes Levenshtein distance between query terms and chunk content, boosting results with high similarity. This helps surface relevant results even when the query contains typos or approximate terms.

```bash
export SEARCH_FUZZY_ENABLED=true
```

### Streaming search (v0.9.0)

**`SEARCH_STREAM_ENABLED`** (default `false`): when `true`, all non-regex, non-symbol searches automatically use streaming mode — keyword and semantic search run in parallel for faster results, with progress notifications and early result preview via MCP logging messages.

```bash
export SEARCH_STREAM_ENABLED=true
```

Or enable per-query:
```json
{
  "query": "authentication middleware",
  "project_name": "my-project",
  "stream": true
}
```

Streaming provides:
- **Parallel execution**: keyword FTS5 + semantic Qdrant search run simultaneously (~1.5-2× faster for hybrid)
- **Progress notifications**: 4-phase updates (Parallel Search → RRF Fusion → Post-processing → Results)
- **Early preview**: top 5 results streamed via MCP logging before final response

---

## `.hnindexignore`

Optional file at the **project root** (the path you pass to `index_codebase`). Gitignore-style patterns via `minimatch` (`*`, `**`, `/`). Excluded paths are not scanned; `index_file` and `watch` follow the same rules.

- **Re-index** after changing this file.
- Negation (`!`) is not supported in v1.

---

[← Back to docs index](README.md)
