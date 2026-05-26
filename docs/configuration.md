# Configuration

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `bge-m3:567m` | Embedding model name |
| `EMBEDDING_DIMENSIONS` | `1024` | Vector size returned by `OLLAMA_MODEL` (must match Ollama output). Use e.g. `768` for [nomic-embed-text-v2-moe](https://ollama.com/library/nomic-embed-text-v2-moe). With **[hnindex CLI](getting-started.md#cli-installer-hnindex)**, pass `--embedding-dimensions <n>` on `hnindex init`; re-running `init` **merges** env and keeps a previous `EMBEDDING_DIMENSIONS` if you omit the flag. **After changing:** delete or recreate the project’s Qdrant collection and **re-index** (existing collections are fixed at creation size). |
| `STORAGE_PATH` | `~/.vibe-hnindex` | SQLite database directory |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant REST URL. For **Qdrant Cloud**, use the full HTTPS URL from the cluster page (often includes `:6333`). |
| `QDRANT_API_KEY` | *(unset)* | **Required** for Qdrant Cloud and any cluster that checks the `api-key` header. Omit for local Docker with no auth. |
| `QDRANT_COLLECTION_PREFIX` | `mcp_ck_` | Prefix for Qdrant collection names |
| `CHUNK_SIZE` | `60` | Target lines per chunk |
| `CHUNK_OVERLAP` | `5` | Overlap lines between chunks |
| `MAX_FILE_SIZE` | `1048576` | Max file size in bytes (1 MB) |
| `INDEX_WORKERS` | `auto` | Number of worker threads for parallel indexing. `0` or `auto` = cpu count − 1 (min 1). Set to a specific number to override. Set to `1` for single-threaded. |
| `INDEX_PARALLEL_BATCH` | `8` | Files per worker batch during parallel indexing. Higher = more throughput but more memory. |
| `SEARCH_AUTO_ROUTE` | `false` | When `true`, omitting `search`’s `mode` behaves like `mode: auto` (heuristic keyword vs hybrid). |
| `SEARCH_KEYWORD_FALLBACK_SEMANTIC` | `true` | When not `false`, if `mode` is keyword and FTS returns no hits, run one semantic search when Ollama and Qdrant are available. |
| `SEARCH_RERANK` | *(enabled)* | Set to `false` to disable post-retrieval reorder (both HTTP rerank and semantic reorder). |
| `SEARCH_RERANK_POOL` | `50` | Max distinct results pulled into the rerank pool before trimming to `limit`. |
| `RERANK_URL` | *(empty)* | If set, POST JSON `{ "query": string, "documents": string[] }`; expect JSON `{ "scores": number[] }` (same length as `documents`, higher = more relevant). |
| `RERANK_TIMEOUT_MS` | `15000` | Timeout (ms) for the `RERANK_URL` request. |
| `SEARCH_CACHE_SIZE` | `100` | Max cache entries for search results (LRU eviction). |
| `SEARCH_CACHE_TTL_MS` | `300000` | Cache TTL in milliseconds (5 min). Cache is skipped for `regex` mode. |
| `SEARCH_FUZZY_ENABLED` | `false` | When `true`, enable fuzzy search re-ranking for all searches by default. Can be overridden per-query with `fuzzy: true/false` tool argument. |

### Parallel indexing (v0.8.0)

**Ollama + `OLLAMA_MODEL` (e.g. `bge-m3:567m`)** handles **embeddings** only (index + query vectors). That is **not** `RERANK_URL`.

- **No `RERANK_URL`:** after hybrid/semantic retrieval, the server **reorders** candidates using **Qdrant similarity scores**. No separate rerank service required.
- **`RERANK_URL` set:** the server sends the query and top chunk texts to **your** HTTP endpoint for finer ranking (e.g. cross-encoder). Ollama’s HTTP API does **not** implement this contract; if you use an Ollama-hosted reranker model, run a tiny proxy that translates `{query, documents}` ↔ your model calls.

**For AI agents:** do not ask users to set `RERANK_URL` unless they need a custom reranker. Default behavior (Qdrant reorder when no URL) is appropriate for normal code search. Use tool argument `rerank: false` only when skipping reorder is desired (speed or debugging).

### Parallel indexing (v0.8.0)

`INDEX_WORKERS` controls parallel file indexing using worker threads. Set to `auto` (or `0`) to use all available CPU cores minus one (minimum 1). Set to a specific number for manual control, or `1` for sequential indexing.

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

Cache is automatically invalidated when the project is re-indexed. Cache is **not used** for `regex` mode since results depend on the pattern.

### Fuzzy search (v0.8.1)

**`SEARCH_FUZZY_ENABLED`** (default `false`): when `true`, all searches automatically apply fuzzy re-ranking after retrieval. Can be overridden per-query with the `fuzzy` tool argument.

Fuzzy search computes Levenshtein distance between query terms and chunk content, boosting results with high similarity. This helps surface relevant results even when the query contains typos or approximate terms.

```bash
export SEARCH_FUZZY_ENABLED=true
```

---

## `.hnindexignore`

Optional file at the **project root** (the path you pass to `index_codebase`). Gitignore-style patterns via `minimatch` (`*`, `**`, `/`). Excluded paths are not scanned; `index_file` and `watch` follow the same rules.

- **Re-index** after changing this file.
- Negation (`!`) is not supported in v1.

---

[← Back to docs index](README.md)
