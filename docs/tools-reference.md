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

Example:

```
search(query: "authentication middleware", project_name: "my-app", mode: "hybrid", limit: 10)
```

**Tips:** narrow `file_pattern` and `limit` on the first pass; use `keyword` when you know exact symbols; set `dedupe_by_file: false` only when you need multiple chunks from the same file. Use `explain: true` for a compact per-result score breakdown (path multiplier, RRF ranks). See [Configuration](configuration.md) for `SEARCH_AUTO_ROUTE` and keyword→semantic fallback.

**Full pipeline:** see [How it works → Search pipeline](how-it-works.md#search-pipeline-query-to-response).

**Rerank (v0.6+):** After retrieval, the server may **reorder** the top pool. If `RERANK_URL` is set in the MCP env, it POSTs `{query, documents}` to that URL and uses returned `scores`; if not, it reorders by **Qdrant semantic scores** (still no extra config). **Ollama** is only for embeddings (`OLLAMA_URL` / `OLLAMA_MODEL`)—not interchangeable with `RERANK_URL`. Agents: treat default search as sufficient; only use `rerank: false` when the user wants to skip reordering. See [Configuration → Optional rerank](configuration.md#optional-rerank).

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

---

[← Back to docs index](README.md)
