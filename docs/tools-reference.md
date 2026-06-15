# Tools reference

These are the MCP **tools** the server exposes. Your assistant calls them by name with arguments (exact names match below). For setup, see [Getting started](getting-started.md).

---

## `index_codebase`

Index an entire directory. Supports incremental re-indexing. The response includes **`Ready: yes`** or **`Ready: no`** and, when Qdrant is available, **`qdrant_vectors: <count>`** (v0.4.0+) so you can confirm the vector collection after indexing.

Optional **`watch`** (default `true`, v0.5.0+): after a successful index, start the same file watcher as `watch_project`. Pass `watch: false` to skip.

```
index_codebase(path: "/path/to/project", project_name: "my-app")
index_codebase(path: "/path/to/project", project_name: "my-app", watch: true)
```

---

## `index_file`

Index or re-index a single file. The project must already exist.

```
index_file(file_path: "/path/to/file.ts", project_name: "my-app")
```

---

## `search`

Search indexed code.

| Mode | Mechanism | Best for |
|------|-----------|----------|
| `keyword` | SQLite FTS5 + BM25 | Exact symbols, identifiers |
| `semantic` | Qdrant cosine similarity | Natural language |
| `hybrid` | RRF fusion | General use (default when `mode` is omitted and `SEARCH_AUTO_ROUTE` is off) |
| `auto` | Heuristic keyword vs hybrid | Let the server pick based on query shape |
| `regex` | RegExp pattern matching | Finding patterns in code (v0.8.0+) |
| `symbol` | SQLite symbol table | Finding definitions by name (v0.8.0+) |

Example:

```
search(query: "authentication middleware", project_name: "my-app", mode: "hybrid", limit: 10)
```

**Tips:** narrow `file_pattern` and `limit` on the first pass; use `keyword` when you know exact symbols; set `dedupe_by_file: false` only when you need multiple chunks from the same file. Use `explain: true` for a compact per-result score breakdown (path multiplier, RRF ranks). See [Configuration](configuration.md) for `SEARCH_AUTO_ROUTE` and keyword→semantic fallback.

**Full pipeline:** see [How it works → Search pipeline](how-it-works.md#search-pipeline-query-to-response).

**Rerank (v0.6+):** After retrieval, the server may **reorder** the top pool. If `RERANK_URL` is set in the MCP env, it POSTs `{query, documents}` to that URL and uses returned `scores`; if not, it reorders by **Qdrant semantic scores** (still no extra config). **Ollama** is only for embeddings (`OLLAMA_URL` / `OLLAMA_MODEL`)—not interchangeable with `RERANK_URL`. Agents: treat default search as sufficient; only use `rerank: false` when the user wants to skip reordering. See [Configuration → Optional rerank](configuration.md#optional-rerank).

### Regex Search (v0.8.0+)

Search code using JavaScript regular expression patterns with `/pattern/flags` syntax.

**Syntax:**
```
search(query: "/useState\(.*\)/", project_name: "my-app", mode: "regex")
search(query: "/TODO|FIXME|HACK/g", project_name: "my-app", mode: "regex")
```

- Pattern is wrapped in `/pattern/flags` — flags are optional (default `i` for case-insensitive)
- Supports all standard JS regex flags: `g`, `i`, `m`, `s`, `u`, `y`
- Auto-detection: when `mode` is `auto` and query looks like `/.../...`, regex mode is selected automatically
- Matches count as the score; results sorted by match count descending
- Matches are highlighted with `**text**` in the output

**Use cases:** finding all TODO comments, specific function call patterns, configuration patterns, error handling patterns.

### Symbol Filters (v0.8.0+)

Filter search results to only files that contain specific symbol types using `symbol_kind`.

**Available kinds:**
| Kind | Description |
|------|-------------|
| `function` | Function definitions |
| `class` | Class definitions |
| `method` | Class/object methods |
| `interface` | Interface definitions |
| `type` | Type alias definitions |
| `variable` | Variable declarations |
| `enum` | Enum definitions |
| `export` | Exported symbols (any kind) |

**Examples:**
```
search(query: "authentication", project_name: "my-app", symbol_kind: "class")
search(query: "handler", project_name: "my-app", symbol_kind: "function")
search(query: "UserData", project_name: "my-app", mode: "symbol", symbol_kind: "interface")
```

**Tips:** combine with `keyword` or `hybrid` mode to narrow results to files with specific symbol types. Works with all search modes including `symbol`.

### Search Cache (v0.8.0+)

Search results are cached using an LRU (Least Recently Used) cache with TTL to avoid redundant searches.

- **Cache size:** `SEARCH_CACHE_SIZE` (default 100 entries)
- **TTL:** `SEARCH_CACHE_TTL_MS` (default 300000ms = 5 minutes)
- Cache key includes: project name, query, mode, limit, and filters
- Automatically invalidated when a project is re-indexed
- Skipped for `regex` mode (results vary with pattern)
- Results include `[cached]` label when served from cache

See [Configuration → Search cache](configuration.md#search-cache-v080) for env vars.

### Fuzzy Search (v0.8.1+)

Boost search results using Levenshtein distance for approximate string matching — useful for misspelled queries or finding similar identifiers.

**How it works:**
1. After normal search results are gathered, each result's content is compared to the query using Levenshtein distance
2. Results with high word-level similarity get a score boost: `score × (1 + fuzzyScore × 0.5)`
3. Results are re-sorted after boosting

**Enable fuzzy:**
```
search(query: "authentication midleware", project_name: "my-app", fuzzy: true)
search(query: "fucntion handleReq", project_name: "my-app", fuzzy: true)
```

**When to use:**
- Queries with possible typos or misspellings
- Searching for identifiers when you're unsure of exact spelling
- Approximate matching when exact FTS5 doesn't return enough results

**Global enable:** set `SEARCH_FUZZY_ENABLED=true` to apply fuzzy re-ranking to all searches by default.

See [Configuration → Fuzzy search](configuration.md#fuzzy-search-v081) for the env var.

---

## `list_projects`

Lists all indexed projects with metadata.

---

## `server_diagnostics` (v0.7.0+)

Health check in one call: Ollama reachability, optional **`embedSingle("ping")`** probe (validates embedding dimensions vs `EMBEDDING_DIMENSIONS`), Qdrant reachability, and a short config summary (`OLLAMA_URL`, `OLLAMA_MODEL`, `STORAGE_PATH`, `QDRANT_URL`, `SEARCH_RERANK`, `RERANK_URL`, etc.).

Optional **`project_name`**: if the project exists and Qdrant is up, compares **SQLite chunk count** with **Qdrant points** for that project’s collection — reports **`match`**, **`mismatch`**, or **`unknown`**, with a short hint if counts diverge.

```
server_diagnostics()
server_diagnostics(project_name: "my-app")
```

---

## `agent_rules_stub` (v0.7.0+)

Short, copy-paste-friendly markdown stub (not a full **`project_briefing`**): project root, last indexed time, primary language + chunk/file stats, optional **`npm test` / `npm run build` / `npm run lint`** lines when those scripts exist in `package.json`, and a few rule-based bullets. Optional **`format`**: `agents` | `claude` | `generic` (title only).

```
agent_rules_stub(project_name: "my-app")
agent_rules_stub(project_name: "my-app", format: "claude")
```

---

## `delete_project`

Removes a project from SQLite and Qdrant.

```
delete_project(project_name: "my-app")
```

---

## `get_file_info`

Metadata for a specific indexed file (chunks, line ranges, language).

```
get_file_info(file_path: "src/index.ts", project_name: "my-app")
```

---

## `project_briefing` (v0.5.0+)

Rule-based project briefing (README, CLAUDE.md, `package.json`, index stats). Cached until the index fingerprint changes (v0.7.0+: fingerprint includes **`indexed_git_head`** when set). Use **`regenerate: true`** to force a rebuild.

---

## `onboarding_prompt` (v0.5.0+)

Single markdown blob for onboarding: optional **Index freshness** (v0.7.0+) when the repo’s current `git HEAD` differs from the commit stored at last index, then cached briefing, **`project_stats`**, and optional recent git activity. Truncated to **`max_chars`** (default 10000). Set **`include_recent: false`** to omit git.

## `chat_context` (v0.12.0+)

Manage chat memory — save, load (chronological or semantic via Qdrant), ingest full conversations, and clear old context. Requires `CHAT_MEMORY_ENABLED=true`.

```
// Save a message
chat_context(action: "save", project_name: "my-app", role: "assistant", content: "...")

// Load recent context (chronological)
chat_context(action: "load", project_name: "my-app", limit: 20)

// Load context via semantic search (Qdrant — saves tokens)
chat_context(action: "load", project_name: "my-app", semantic_query: "auth middleware")

// Ingest full conversation at session end
chat_context(action: "ingest", project_name: "my-app",
  messages: [{ role: "user", content: "..." }, ...])

// Clear old entries
chat_context(action: "clear", project_name: "my-app", max_age_hours: 168)
```

---

[← Back to docs index](README.md)
