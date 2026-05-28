// Auto-generated from ../docs/changelog.md — do not edit manually
export interface VersionEntry {
  title: string;
  items: string[];
}

export const changelogData: VersionEntry[] = [
  {
    title: "v0.11.1 — Smart Context Fix + CLI",
    items: [
      "**📄 Smart Context** — Content limit increased 10×: 2500 → 25000 characters per file. New env `SMART_CONTEXT_MAX_FILE_CHARS` with `0` = unlimited. Files with 500+ lines now show near-complete content.",
      "Preview chunks increased: 2-3 → 3-5 for task mode, giving AI more context upfront.",
      "**🔧 CLI defaults** — `hnindex init` now includes `CODE_AGENT_ENABLED`, `CODE_AGENT_SCOPE`, and `SMART_CONTEXT_MAX_FILE_CHARS` in generated config.",
      "**📝 SKILL.md** — Expanded Code Agent usage guide for AI agents with full params, output format, and when-to-use guidance.",
      "**📦 Versions** — `vibe-hnindex` v0.11.1, `hnindex-cli` v0.11.1.",
    ],
  },
  {
    title: "v0.11.0 — 🤖 Code Agent",
    items: [
      "**🤖 code_session** — One call replaces 5–15 search+read calls. Returns structured context package with core files (full content), similar patterns, dependency analysis, test files, and impact analysis.",
      "Auto-detects: task type (add-feature/refactor/debug/explain), framework (Next.js, Express, React, etc.), and test framework (vitest, jest, pytest).",
      "**✏️ code_apply** — Apply code changes safely with 3 scopes: `safe` (read-only preview), `moderate` (create + modify non-critical files), `full`. Auto-runs tests, lint, and typecheck after applying.",
      "Supports create, modify (with unified diff), and delete actions. Blocks restricted files in moderate mode (.env, config files, lockfiles).",
      "**🔧 Feature flag** — `CODE_AGENT_ENABLED=true` + `CODE_AGENT_SCOPE` (safe/moderate/full). Default off — zero impact on existing users.",
      "**📚 Docs Site** — Full documentation site at docs.hnindex.cloud with 15 pages: Getting Started, Configuration, Tools reference, Performance tuning, Troubleshooting.",
      "Embedding model comparison table added — bge-m3, nomic-embed-text, qwen3-embedding, mxbai-embed-large, snowflake-arctic-embed2, all-minilm with MTEB scores and recommendations.",
      "**🎨 Website** — Added Documentation link to hnindex.cloud navbar.",
      "**📦 Versions** — `vibe-hnindex` v0.11.0, `hnindex-cli` v0.11.0.",
    ],
  },
  {
    title: "v0.10.0 — 🧠 Smart Context",
    items: [
      "**📄 Smart Context nâng cấp** — Tool `smart_context` now supports 3 new modes:",
      "**Task mode**: `task=\"add rate limiting\"` → auto-analyzes impact, finds test files, detects similar code patterns",
      "**Question mode**: `question=\"how does auth flow work?\"` → auto-searches relevant code, gathers full context (imports, dependents, symbols)",
      "**Refactor mode**: `task=\"refactor\"` → full impact analysis (depth 3) + all affected files + test files + similar patterns",
      "**Auto-detect**: server infers task type (explain/refactor/debug/add-feature) from task description to provide optimal context",
      "**🔧 CLI Init upgrade** — `hnindex init --mcp` now generates all 16 env vars by default (INDEX_WORKERS, SEARCH_STREAM_ENABLED, SEARCH_FUZZY_ENABLED, SEARCH_CACHE_SIZE, and more)",
      "**📦 Versions** — `vibe-hnindex` v0.10.0, `hnindex-cli` v0.10.0.",
    ],
  },
  {
    title: "v0.9.8",
    items: [
      "**🔧 Fix** — `hnindex init-skill` no longer reads SKILL.md from disk. Content is inlined to avoid ENOENT errors when installed via npm.",
      "**📦 Versions** — `vibe-hnindex` v0.9.8, `hnindex-cli` v0.9.8.",
    ],
  },
  {
    title: "v0.9.5",
    items: [
      "**📄 Agent Skill** — New `use-vibe-hnindex` skill for AI agents (Claude, Antigravity, Cursor, Codex). Auto-loaded to understand all 20 tools, search modes, streaming, fuzzy matching, and best practices.",
      "**🔧 CLI `init-skill`** — New `hnindex init-skill --target <editor>` command creates the skill file in the correct directory for your editor.",
      "**🔬 Benchmark Tool** — New `benchmark_search` tool runs a suite of test queries with and without streaming, reports avg/min/max timing and speedup ratios.",
      "**📦 Versions** — `vibe-hnindex` v0.9.5, `hnindex-cli` v0.9.5.",
    ],
  },
  {
    title: "v0.9.4",
    items: [
      "**🔬 Benchmark Tool** — New `benchmark_search` tool runs a suite of test queries (keyword, hybrid, regex, fuzzy) with and without streaming.",
      "Reports timing (avg/min/max), result counts, and speedup ratios in a comparison table. One command = full performance report.",
      "No more prompting AI to benchmark — just call `benchmark_search(project_name, runs=2)`.",
      "**📦 Versions** — `vibe-hnindex` v0.9.4, `hnindex-cli` v0.9.4.",
    ],
  },
  {
    title: "v0.9.1",
    items: [
      "**⚡ Single-Pass Indexing** — Dependency, export, and symbol parsing is now done during the initial file scan, eliminating the second full directory scan entirely.",
      "Before: `index_codebase` scanned all files twice — once for chunking/embedding, then again for parsing imports/exports/symbols. Now: one pass does everything.",
      "Speed improvement: ~30–40% faster indexing on large codebases, especially noticeable on incremental re-indexes.",
      "**🔬 Fast Hash** — File change detection now uses SHA-1 instead of SHA-256 (~2× faster, still reliable for code deduplication).",
      "**📦 Versions** — `vibe-hnindex` v0.9.1, `hnindex-cli` v0.9.1.",
    ],
  },
  {
    title: "v0.9.0",
    items: [
      "**⚡ Streaming Search** — New `stream: true` flag (or env `SEARCH_STREAM_ENABLED=true`) enables parallel search execution: keyword FTS5 + semantic Qdrant run simultaneously instead of sequentially.",
      "Progress notifications: 4-phase updates (Parallel Search → RRF Fusion → Post-processing → Results) keep you informed of search progress in real-time.",
      "Early result preview: top 5 results streamed via MCP logging messages before the search completes, so you can start reviewing immediately.",
      "Speed improvement: ~1.5–2× faster for hybrid search on multi-core machines. Keyword-only and semantic-only modes also benefit from parallel health checks.",
      "ENV: `SEARCH_STREAM_ENABLED` (default false) — enable streaming by default for all non-regex, non-symbol searches.",
      "**Refactor** — Extracted `parallelSearch()` orchestrator, `sendProgress()` notifications, `sendSearchPreview()`, and `applyFuzzyBoost()` into `services/streaming-search.ts` for cleaner architecture.",
      "**📦 Versions** — `vibe-hnindex` v0.9.0, `hnindex-cli` v0.9.0.",
    ],
  },
  {
    title: "v0.8.1",
    items: [
      "**🔤 Fuzzy Search** — New `fuzzy: true` flag uses Levenshtein distance to detect typos and re-rank search results.",
      "Typing 'fucntion' still finds functions. Query 'libery' surfaces 'library'. Boost factor: 0.5× similarity score added to original ranking.",
      "Auto-detection: queries with repeated characters, swapped letters, or common misspellings automatically enable fuzzy mode.",
      "Env: `SEARCH_FUZZY_ENABLED` (default false) — enable fuzzy search by default for all queries.",
      "**📝 Docs Update** — `tools-reference.md`: added sections for Regex Search, Symbol Filters, Search Cache, and Fuzzy Search with examples and best practices.",
      "`configuration.md`: added 7 new environment variables for parallel indexing, search cache, and fuzzy search.",
    ],
  },
  {
    title: "v0.8.0",
    items: [
      "**⚡ Parallel Indexing** — `index_codebase` now uses a worker threads pool (auto = CPU count − 1, min 1 worker) to chunk and embed files in parallel.",
      "Speed improvement: ~3–4× faster indexing on multi-core machines. Real-time progress percentage shown during indexing.",
      "Env: `INDEX_WORKERS` (default auto), `INDEX_PARALLEL_BATCH` (default 8).",
      "**💾 Search Cache** — LRU cache with 100 entries and 5-minute TTL. Cache key = `project|query|mode|limit|filters`.",
      "Second identical search returns instantly (~5 ms vs ~800 ms). Cache auto-invalidates on `index_codebase` or `index_file`.",
      "Env: `SEARCH_CACHE_SIZE` (default 100), `SEARCH_CACHE_TTL_MS` (default 300000).",
      "**🔍 Regex Search** — New `mode: 'regex'` using JavaScript RegExp to match patterns in chunk content.",
      "Auto-detect: wrap your query in `/pattern/flags`. Highlights matches with `**text**` markers. Results sorted by match count.",
      "**🏷️ Symbol Filters** — Filter search results by `symbol_kind`: `function`, `class`, `method`, `interface`, `type`, `variable`, `enum`, `export`.",
      "Only returns chunks from files containing matching symbol types. Uses the existing symbols table (v0.6.0).",
      "**📦 Versions** — `vibe-hnindex` v0.8.0, `hnindex-cli` v0.8.0.",
    ],
  },
  {
    title: "v0.7.2",
    items: [
      "**⏱️ Timeouts** — Added timeouts to prevent the MCP server from hanging when Ollama or Qdrant are unresponsive.",
      "Ollama embed/health calls: `OLLAMA_TIMEOUT_MS` (default 30 s).",
      "Qdrant client API calls: `QDRANT_TIMEOUT_MS` (default 15 s).",
      "Overall search operation: `SEARCH_TIMEOUT_MS` (default 60 s).",
      "**🛡️ Search Stability** — `search` wrapped with `withTimeout()`. On timeout returns a clear error message instead of hanging indefinitely.",
      "**📖 README** — Added a dedicated Timeouts section listing all timeout environment variables.",
      "**🔄 CI** — Separated `create-release` job so GitHub Releases are created independently of npm publish (no more blocked releases).",
    ],
  },
  {
    title: "v0.7.1",
    items: [
      "**🐛 Deep Indexing on Windows** — Fixed `realpath` crash when traversing deeply nested folders.",
      "Now falls back to `path.resolve()` with lowercase path comparison on Windows, preventing entire subdirectory trees from being skipped.",
      "**📁 Removed Extension Filter** — Deleted the hard-coded `SUPPORTED_EXTENSIONS` set.",
      "Every text file (non-binary) is now indexed — no more silently skipping `.prisma`, `.env.local`, `.eslintrc`, and other uncommon formats.",
      "**📦 CLI Bump** — `hnindex-cli` synced to v0.7.1.",
    ],
  },
  {
    title: "v0.7.0 (vibe-hnindex) / hnindex-cli v0.7.0",
    items: [
      "**🔧 `server_diagnostics`** — One-call health check: Ollama, Qdrant, config summary, optional embedding probe.",
      "Optional `project_name` parameter compares SQLite chunk count vs Qdrant collection points (`match` / `mismatch` / `unknown`).",
      "**📋 `agent_rules_stub`** — Short markdown for CLAUDE.md / AGENTS.md with project path, last index time, top language + stats, and `package.json` script hints.",
      "Optional `format`: `agents`, `claude`, or `generic`.",
      "**🕐 Git Index Freshness** — SQLite `projects.indexed_git_head` stores `git rev-parse HEAD` after indexing.",
      "`onboarding_prompt` shows Index Freshness when current HEAD differs from stored head. `project_briefing` cache key includes git head.",
      "**📦 Versions** — MCP `server.json`, `.claude-plugin` metadata, npm packages, and startup log all updated to v0.7.0.",
    ],
  },
  {
    title: "v0.6.1 (vibe-hnindex) / hnindex-cli v0.6.2",
    items: [
      "**📐 `EMBEDDING_DIMENSIONS`** — Documented in MCP `server.json`.",
      "`hnindex init` now merges with existing MCP `env`, so `EMBEDDING_DIMENSIONS` (and other keys) persist when you re-run init without `--embedding-dimensions`.",
      "**📟 Startup Log** — MCP server stderr now shows v0.6.1.",
    ],
  },
  {
    title: "v0.6.0",
    items: [
      "**🖥️ `hnindex-cli`** — New global CLI: `hnindex init --mcp <claude|claude-desktop|antigravity|cursor|cursor-project|windsurf|vscode>`, `hnindex update`, `hnindex version`.",
      "Auto-merges `vibe-hnindex` into the correct MCP JSON path on Windows, macOS, and Linux.",
      "**🏗️ Symbols Table + Indexing** — Heuristic symbol extraction (TS/JS/TSX/JSX, Python) on index/reindex/watch. SQLite `symbols` table with name-based lookup.",
      "**🔎 `symbol_lookup` Tool** — Resolve symbols by name with optional kind and file pattern filters.",
      "**🔤 `search` Mode `symbol`** — Find chunks via symbol name (explicit mode; `auto` does not route to symbol).",
      "**🔄 Optional Rerank** — `RERANK_URL` for POST `{ query, documents }` → `{ scores }`. Falls back to Qdrant semantic score reorder.",
      "Env: `SEARCH_RERANK`, `SEARCH_RERANK_POOL`, `RERANK_TIMEOUT_MS`.",
      "**📊 `codebase_overview`** — Richer detection: Prisma, Tailwind, shadcn/ui (`components.json`), Turborepo/Nx, lockfile → package manager, monorepo hints.",
    ],
  },
  {
    title: "v0.4.0",
    items: [
      "**🏃 Search — Project Race** — `getProjectWithRetry` eliminates rare \"project not found\" errors right after indexing.",
      "**✅ Index Readiness** — Summary ends with `Ready: yes|no`. When Qdrant is up, shows `qdrant_vectors: <count>` after collection verify.",
      "**🤖 Mode: Auto** — Heuristic routing between keyword and hybrid. Set `SEARCH_AUTO_ROUTE=true` to treat omitted `mode` as `auto`.",
      "**🔁 Keyword → Semantic Fallback** — If keyword returns no hits and Ollama+Qdrant are OK, one semantic pass runs automatically.",
      "Enabled by default. Set `SEARCH_KEYWORD_FALLBACK_SEMANTIC=false` to disable.",
      "**📝 Explain** — Optional per-result score breakdown: path multiplier, RRF hints, semantic raw score.",
      "**📐 MCP Schema** — `search` exposes `content_mode`, `max_content_chars`, `deprioritize_generated_paths`, `mode` (including `auto`), and `explain`.",
    ],
  },
  {
    title: "v0.5.0",
    items: [
      "**📋 `project_briefing`** — Rule-based briefing from README, CLAUDE.md, `package.json`, and index statistics.",
      "Cached in SQLite with key `file_count|chunk_count|last_indexed_at`. Supports `regenerate` parameter.",
      "**🚀 `onboarding_prompt`** — Single markdown block: briefing + stats + optional recent git activity. Truncated by `max_chars`.",
      "**👀 `index_codebase` — Watch** — New `watch` parameter (default `false`). Enables file watcher after indexing, same as `watch_project`.",
      "**🔄 Watch** — Shared `startWatchingProject` logic used by both `watch_project` and `index_codebase` + `watch`.",
    ],
  },
  {
    title: "v0.3.3",
    items: [
      "**🔑 `QDRANT_API_KEY`** — Optional for local Docker; required for Qdrant Cloud.",
      "Set with `QDRANT_URL` = your HTTPS cluster URL from the Qdrant Cloud dashboard.",
      "**⚠️ Startup Hint** — If `QDRANT_URL` looks like Cloud (HTTPS + `qdrant` host) but no API key is set, a clear warning is logged on first Qdrant use.",
      "**📚 Docs** — Getting Started and Configuration pages now spell out Cloud vs self-hosted env vars. Default `OLLAMA_URL` is `http://localhost:11434`.",
    ],
  },
  {
    title: "v0.3.2",
    items: [
      "**📏 `content_mode`** — Default `compact` truncates chunk bodies to save tokens. Use `full` for entire chunks.",
      "**🔀 Keyword OR Fallback** — If strict FTS AND returns nothing with multi-token queries, automatically retries with OR and shows a warning.",
      "**📂 Deprioritize Generated Paths** — Down-ranks results from `dist/`, `.next/`, `build/`, `coverage/`, `*.min.js`, `node_modules`, etc.",
      "**🔄 Project Stats Retry** — Reduces rare \"project not found\" errors right after indexing by retrying the stats query.",
    ],
  },
  {
    title: "v0.3.1",
    items: [
      "**🔤 Keyword Query Normalization** — Tokenizes punctuation-heavy queries for better FTS5 matching.",
      "**📄 Dedupe by File** — One chunk per file by default (`dedupe_by_file`). Cleaner, less noisy results.",
      "**🙈 `.hnindexignore`** — Exclude paths from indexing using minimatch patterns (gitignore-style syntax).",
    ],
  },
];
