# Changelog (highlights)

## v0.10.0 — 🧠 Smart Context Generator

- **📄 Smart Context nâng cấp** — `smart_context` tool giờ hỗ trợ 3 chế độ mới:
  - **Task mode**: `task="thêm rate limiting"` → tự phân tích impact, tìm test files, tìm code pattern tương tự
  - **Question mode**: `question="luồng auth chạy sao?"` → tự search code liên quan, gom đầy đủ context imports/dependents/symbols
  - **Refactor mode**: `task="refactor"` → full impact analysis depth 3 + tất cả file bị ảnh hưởng + test files + similar patterns
- **🔍 Auto-detect task type** — Server tự nhận diện loại task (explain/refactor/debug/add-feature) để cung cấp context phù hợp
- **🔧 CLI Init** — `hnindex init --mcp` giờ sinh đầy đủ 16 env vars (INDEX_WORKERS, SEARCH_STREAM_ENABLED, SEARCH_FUZZY_ENABLED, SEARCH_CACHE_SIZE...)
- **Versions** — `vibe-hnindex` v0.10.0, `hnindex-cli` v0.10.0.

## v0.9.8

- **🔧 Fix** — `hnindex init-skill` nội dung skill inline thay vì đọc file (tránh lỗi ENOENT khi cài qua npm).
- **Versions** — `vibe-hnindex` v0.9.8, `hnindex-cli` v0.9.8.

## v0.9.5

- **📄 Agent Skill** — Skill `use-vibe-hnindex` trong `skills/use-vibe-hnindex/SKILL.md` — AI agent (Claude, Antigravity, Cursor, Codex) tự động load và hiểu hết 20 tools.
- **🔧 CLI `init-skill`** — `hnindex init-skill --target claude` tạo skill file cho editor tương ứng.
- **🔬 Benchmark Tool** — Tool `benchmark_search`: chạy bộ test queries (keyword, hybrid, regex, fuzzy) có/không streaming, báo cáo bảng so sánh thời gian + speedup.
- **Versions** — `vibe-hnindex` v0.9.5, `hnindex-cli` v0.9.5.

## v0.9.4

- **🔬 Benchmark Tool** — Tool mới `benchmark_search`: chạy bộ test queries (keyword, hybrid, regex, fuzzy) có và không có streaming, báo cáo thời gian (avg/min/max), số kết quả, và speedup ratio. 1 câu là ra bảng so sánh performance.
- **Versions** — `vibe-hnindex` v0.9.4, `hnindex-cli` v0.9.4.

## v0.9.1

- **⚡ Single-Pass Indexing** — Gộp dependency/symbol parsing vào lần scan đầu tiên, loại bỏ hoàn toàn lần scan thứ 2. Trước đây index_codebase quét toàn bộ file 2 lần: lần 1 để chunk+embed, lần 2 để parse imports/exports/symbols. Giờ chỉ cần 1 lần duy nhất — nhanh hơn ~30-40% trên codebase lớn.
- **🔬 Fast Hash** — Thay SHA-256 bằng SHA-1 cho change detection (~2x nhanh hơn, vẫn đủ mạnh để phát hiện file thay đổi).
- **Versions** — `vibe-hnindex` v0.9.1, `hnindex-cli` v0.9.1.

## v0.9.0

- **⚡ Streaming Search** — `stream: true` (hoặc env `SEARCH_STREAM_ENABLED=true`) kích hoạt tìm kiếm song song: keyword FTS5 + semantic Qdrant chạy đồng thời thay vì tuần tự. Hỗ trợ progress notifications 4 phase (Parallel Search → RRF Fusion → Post-processing → Results) và early result preview qua logging messages. Nhanh hơn ~1.5-2x cho hybrid search.
- **Refactor** — Tách `parallelSearch()` orchestrator, `sendProgress()` notifications, `sendSearchPreview()`, `applyFuzzyBoost()` vào `services/streaming-search.ts`.
- **Env** — `SEARCH_STREAM_ENABLED` (default false) bật streaming cho mọi search không phải regex/symbol.
- **Versions** — `vibe-hnindex` v0.9.0, `hnindex-cli` v0.9.0.

## v0.8.1

- **Fuzzy Search** — cờ `fuzzy: true` dùng Levenshtein distance để phát hiện typo và re-rank kết quả. Auto-detect query có dấu hiệu sai chính tả (lặp ký tự, common misspelling). Env: `SEARCH_FUZZY_ENABLED`.
- **Docs Update** — `tools-reference.md`: thêm section Regex Search, Symbol Filters, Search Cache, Fuzzy Search. `configuration.md`: thêm 7 env vars mới (INDEX_WORKERS, INDEX_PARALLEL_BATCH, SEARCH_CACHE_SIZE, SEARCH_CACHE_TTL_MS, SEARCH_FUZZY_ENABLED).

## v0.8.0

- **Parallel Indexing** — `index_codebase` dùng worker threads pool (tự động = CPU-1 workers) để chunk + embed song song; nhanh hơn ~3-4x trên máy multi-core. Progress hiển thị % trong quá trình index. Env: `INDEX_WORKERS`, `INDEX_PARALLEL_BATCH`.
- **Search Cache** — LRU cache 100 entries với TTL 5 phút; cache key = `project|query|mode|limit|filters`. Search lần 2 trả về ngay lập tức (~5ms vs 800ms). Tự invalidate khi re-index. Env: `SEARCH_CACHE_SIZE`, `SEARCH_CACHE_TTL_MS`.
- **Regex Search** — mode `regex` dùng JavaScript RegExp tìm pattern trong chunk content. Auto-detect nếu query bọc trong `/pattern/flags`. Highlight match với `**text**`, sort theo số lượng match.
- **Symbol Filters** — lọc kết quả search theo `symbol_kind`: `function`, `class`, `method`, `interface`, `type`, `variable`, `enum`, `export`. Chỉ trả về chunks từ file chứa symbol loại đó.
- **Versions** — `vibe-hnindex` v0.8.0, `hnindex-cli` v0.8.0.

## v0.7.2

- **Timeouts** — thêm timeout cho Ollama embed/health (`OLLAMA_TIMEOUT_MS`, default 30s), Qdrant client (`QDRANT_TIMEOUT_MS`, default 15s), và overall search (`SEARCH_TIMEOUT_MS`, default 60s). Ngăn treo khi service không phản hồi.
- **Search stability** — `search` được wrap với `withTimeout()`; nếu quá hạn, trả về lỗi rõ ràng thay vì treo vô hạn.
- **README** — thêm section **Timeouts** liệt kê các env vars timeout.
- **CI** — tách `create-release` job độc lập, không phụ thuộc npm publish.

## v0.7.1

- **Index sâu trên Windows** — fix `realpath` crash khi duyệt folder sâu; fallback về `path.resolve()` + lowercase compare để tránh skip toàn bộ subfolder.
- **Bỏ giới hạn extension** — xóa `SUPPORTED_EXTENSIONS` hard-coded; mọi text file (không phải binary) đều được index, không bỏ sót `.prisma`, `.env.local`, `.eslintrc`, v.v.
- **hnindex-cli bump** — đồng bộ version CLI lên 0.7.1.

## v0.7.0 (vibe-hnindex) / hnindex-cli v0.7.0

- **`server_diagnostics`** — one call checks Ollama, Qdrant, config summary, optional embedding probe; optional **`project_name`** compares SQLite chunk count vs Qdrant collection points (`match` / `mismatch` / `unknown`).
- **`agent_rules_stub`** — short markdown for CLAUDE.md / AGENTS.md (optional **`format`**: `agents` | `claude` | `generic`): path, last index time, top language + stats, `package.json` script hints (`npm test`, `npm run build`, `npm run lint` when present), rule-based bullets — not a full `project_briefing`.
- **Git index freshness** — SQLite `projects.indexed_git_head` stores `git rev-parse HEAD` after successful `index_codebase`, `index_file`, and watch reindex; **`onboarding_prompt`** adds **Index freshness** when current HEAD differs from stored head; **`project_briefing` cache key** includes git head so briefings refresh after re-index.
- **Versions** — MCP `server.json`, `.claude-plugin` plugin + marketplace metadata, root npm package, **`hnindex-cli`** npm package, and startup log **v0.7.0**.

## v0.6.1 (vibe-hnindex) / hnindex-cli v0.6.2

- **`EMBEDDING_DIMENSIONS`** — documented in MCP `server.json`; `hnindex init` **merges** with existing MCP `env` so `EMBEDDING_DIMENSIONS` (and other keys) persist when you re-run init without `--embedding-dimensions`.
- **Startup log** — MCP server stderr shows **v0.6.1**.

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
