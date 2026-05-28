# vibe-hnindex — Agent Guide

> MCP server for indexing & searching codebases with keyword + semantic + hybrid modes.

## Quick Start

```
1. Index:   index_codebase(path="/path/to/project", project_name="my-project")
2. Search:  search(query="auth middleware", project_name="my-project", stream=true)
```

## All Tools

| Tool | Purpose | Key Params |
|------|---------|------------|
| `index_codebase` | Index entire directory | `path`, `project_name`, `watch` (default true) |
| `index_file` | Re-index single file | `file_path`, `project_name` |
| `search` | Full-text + vector search | `query`, `project_name`, `mode`, `stream`, `fuzzy` |
| `list_projects` | List indexed projects | — |
| `delete_project` | Delete project data | `project_name` |
| `server_diagnostics` | Health check | `project_name` (optional) |
| `agent_rules_stub` | Rules for AGENTS.md | `project_name`, `format` |
| `project_stats` | Stats breakdown | `project_name` |
| `codebase_overview` | Architecture overview | `project_name` |
| `project_briefing` | Cached project summary | `project_name` |
| `onboarding_prompt` | Onboarding blob | `project_name` |
| `symbol_lookup` | Find symbol definition | `project_name`, `symbol`, `kind` |
| `file_summary` | File overview | `project_name`, `file_path` |
| `get_file_info` | File chunk details | `file_path`, `project_name` |
| `get_dependencies` | Imports of file | `project_name`, `file_path` |
| `get_dependents` | Files importing this | `project_name`, `file_path` |
| `impact_analysis` | Transitive impact | `project_name`, `file_path`, `depth` |
| `recent_changes` | Recent git commits | `project_name`, `days`, `limit` |
| `smart_context` | One-call file context | `project_name`, `file_path/query` |
| `watch_project` | Auto re-index on change | `project_name` |
| `unwatch_project` | Stop watching | `project_name` |

## Search Modes

| Mode | Use When | Speed |
|------|----------|-------|
| `keyword` | Exact identifiers, file paths, short queries | ⚡ Fastest |
| `semantic` | Natural language, concepts, "how does X work" | 🐢 Slower (needs Ollama) |
| `hybrid` | Best of both — RRF fusion | ⚡⚡ Balanced (default) |
| `auto` | Let server decide based on query | ⚡ Auto |
| `regex` | Pattern matching `/pattern/flags` | ⚡ Fast |
| `symbol` | Symbol name lookup in SQLite | ⚡⚡ Very fast |

## Streaming Search (v0.9.0)

Add `stream=true` to searches for parallel keyword+semantic execution:
```json
{ "query": "auth middleware", "project_name": "my-project", "stream": true }
```

Or enable globally: `SEARCH_STREAM_ENABLED=true`

**How it works**: Keyword FTS5 and semantic Qdrant run simultaneously (Promise.all) instead of sequentially. This reduces total search time by ~1.5-2x.

**NOT just TTFB** — the actual total response time is faster because two independent searches run in parallel.

**Progress**: 4-phase notifications sent via MCP `notifications/progress`.

**Preview**: Top 5 results streamed via MCP `logging` messages before final response.

## Fuzzy Search (v0.8.1)

Add `fuzzy=true` to auto-correct typos:
```json
{ "query": "fucntion", "project_name": "my-project", "fuzzy": true }
```
Typing "fucntion" still finds "function". "libery" finds "library".

## Best Practices

### Searching
- **Narrow first**: use `file_pattern` to scope, then widen
- **Small limit**: start with `limit=5-10`, increase if needed
- **Dedupe**: `dedupe_by_file=true` (default) for diverse results
- **Expand context**: `expand_context=1-2` to see surrounding code
- **Stream**: always use `stream=true` for better UX on hybrid/semantic

### Indexing
- **First time**: index is slow (embeddings via Ollama), be patient
- **Re-index**: only changed files are re-processed (hash-based incremental)
- **Watch**: `watch=true` (default) auto re-indexes on file save
- **Large projects**: increase `INDEX_PARALLEL_BATCH` for more throughput

### Symbol Filters
Filter results by `symbol_kind`: `function`, `class`, `method`, `interface`, `type`, `variable`, `enum`, `export`

## Key Env Vars

| Var | Default | Purpose |
|-----|---------|---------|
| `OLLAMA_URL` | localhost:11434 | Ollama server |
| `OLLAMA_MODEL` | bge-m3:567m | Embedding model |
| `QDRANT_URL` | localhost:6333 | Qdrant vector DB |
| `SEARCH_STREAM_ENABLED` | false | Enable streaming for all searches |
| `SEARCH_FUZZY_ENABLED` | false | Enable fuzzy for all searches |
| `SEARCH_AUTO_ROUTE` | false | Auto-select search mode |
| `INDEX_WORKERS` | auto | Parallel indexing workers |
| `SEARCH_CACHE_SIZE` | 100 | LRU cache entries |
| `SEARCH_CACHE_TTL_MS` | 300000 | Cache TTL (5 min) |

## Common Workflows

### Setup & First Search
```
→ index_codebase(path="/project", project_name="my-project")
→ search(query="authentication", project_name="my-project", stream=true)
```

### Debug a File
```
→ smart_context(project_name="my-project", file_path="src/auth.ts", task="fix login bug")
→ search(query="token validation", project_name="my-project", file_pattern="src/auth/**")
```

### Understand Code Flow (NEW v0.10.0)
```
→ smart_context(project_name="my-project", question="how does auth flow work?")
→ smart_context(project_name="my-project", file_path="src/api.ts", task="refactor")
```

### Find All Implementations
```
→ symbol_lookup(project_name="my-project", symbol="AuthService", kind="class")
→ get_dependents(project_name="my-project", file_path="src/auth/service.ts")
```

### Code Agent — 2-Call Workflow (NEW v0.11.0) ⚡
```
→ code_session(project_name="my-project", task="add rate limiting")
  // Returns: full context package (files, patterns, deps, tests, impact)
  // AI reasons → decide edits
→ code_apply(project_name="my-project", edits=[...], verify=true)
  // Applies changes + runs tests + lint + typecheck
```

### Check Impact Before Refactor
```
→ smart_context(project_name="my-project", file_path="src/auth.ts", task="refactor")
→ impact_analysis(project_name="my-project", file_path="src/auth/service.ts", depth=3)
```
