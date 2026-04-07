# Changelog (highlights)

## v0.6.0

- **`hnindex-cli`** (npm: `hnindex-cli`) — global CLI `hnindex`: `init --mcp <claude|claude-desktop|antigravity|cursor|cursor-project|windsurf|vscode>`, `update`, `version`; merges `vibe-hnindex` into the correct MCP JSON path on Windows, macOS, and Linux. Package: `packages/hnindex-cli`.
- **Symbols table + indexing** — heuristic extraction (TS/JS/TSX/JSX, Python) on index/reindex/watch; SQLite `symbols` with lookup by name.
- **`symbol_lookup` tool** — resolve symbols by name with optional kind / file pattern filters.
- **`search` mode `symbol`** — find chunks via symbol name (explicit mode; `auto` does not route to symbol).
- **Optional rerank** — `RERANK_URL` POST `{ query, documents }` → `{ scores }`; if unset or on failure, reorder pool by Qdrant semantic score when available. Env: `SEARCH_RERANK`, `SEARCH_RERANK_POOL`, `RERANK_TIMEOUT_MS`.
- **`codebase_overview`** — richer detection: Prisma, Tailwind, shadcn (`components.json`), Turborepo/Nx, lockfile → package manager, monorepo hints.
- **MCP / package** — version **0.6.0**.

## v0.4.0

- **`search` — project race** — uses `getProjectWithRetry` so “project not found” right after `index_codebase` is rare.
- **`index_codebase` readiness** — summary ends with `Ready: yes|no` and, when Qdrant is up, `qdrant_vectors: <count>` after a best-effort collection verify.
- **`mode: auto`** — heuristic routing to keyword vs hybrid (optional **`SEARCH_AUTO_ROUTE=true`** to treat omitted `mode` like `auto`).
- **Keyword → semantic fallback** — if keyword returns no hits and Ollama+Qdrant are OK, one semantic pass runs (default **`SEARCH_KEYWORD_FALLBACK_SEMANTIC`** on; set to `false` to disable).
- **`explain`** — optional per-result score breakdown (path multiplier, RRF / semantic hints).
- **MCP schema** — `search` exposes `content_mode`, `max_content_chars`, `deprioritize_generated_paths`, `mode` including `auto`, and `explain`.

## v0.5.0

- **`project_briefing`** — briefing rule-based từ README, CLAUDE.md, `package.json` và thống kê index; cache SQLite với khóa `file_count|chunk_count|last_indexed_at`; tham số `regenerate`.
- **`onboarding_prompt`** — một khối markdown: briefing + stats + (tuỳ chọn) git gần đây; cắt theo `max_chars`.
- **`index_codebase`** — tham số **`watch`** (mặc định `false`); sau khi index thành công có thể bật cùng watcher như `watch_project`.
- **Watch** — logic chung `startWatchingProject` dùng cho `watch_project` và `index_codebase` + `watch`.

## v0.3.3

- **`QDRANT_API_KEY`** — optional for local Docker; **required** for [Qdrant Cloud](https://cloud.qdrant.io/) (set with `QDRANT_URL` = HTTPS cluster URL from the dashboard).
- **Startup hint** — if `QDRANT_URL` looks like Cloud (HTTPS + `qdrant` host) but the API key is missing, the server logs a clear warning on first Qdrant use.
- **Docs** — [Getting started](getting-started.md) and [Configuration](configuration.md) spell out Cloud vs self-hosted env vars; default `OLLAMA_URL` is `http://localhost:11434` (override with `OLLAMA_URL` when needed).

## v0.3.2

- **`content_mode`** (default `compact`) — truncates chunk bodies to save tokens; use `full` for entire chunks.
- **Keyword OR fallback** — if strict FTS AND returns nothing and the query has multiple tokens, retry with OR and a warning.
- **`deprioritize_generated_paths`** — down-ranks `dist/`, `.next/`, `build/`, `coverage/`, `*.min.js`, `node_modules`, etc.
- **`project_stats` retry** — reduces rare “project not found” right after indexing.

## v0.3.1

- **Keyword query normalization** — tokenizes punctuation-heavy queries for FTS5.
- **`dedupe_by_file`** — one chunk per file by default.
- **`.hnindexignore`** — exclude paths from indexing (minimatch).

---

[← Back to docs index](README.md)
