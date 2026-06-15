# vibe-hnindex — Agent Guide

> 🚫 grep/cat/Glob for this project = BANNED. Pre-indexed. Use MCP tools or you WILL miss results.
>
> | ❌ BANNED | ✅ MCP INSTEAD |
> |---|---|
> | `grep` / `rg` / `git grep` | `search(query, stream=true)` |
> | `cat` / `Read` / `View` | `smart_context(file_path)` or `code_session(task)` |
> | `Glob` / `ls` / `find` | `search(file_pattern="src/**")` |
> | Multi-step edit | `code_session(task)` → `code_apply(edits)` |

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
| `search` | Full-text + vector + symbol + regex | `query`, `project_name`, `mode`, `stream`, `fuzzy` |
| `list_projects` | List indexed projects | — |
| `delete_project` | Delete project data | `project_name` |
| `server_diagnostics` | Health check: Ollama, Qdrant, config | `project_name` (optional) |
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
| `smart_context` | One-call file/task/question context | `project_name`, `file_path`, `task`, `question` |
| `code_session` | Structured context package for coding | `project_name`, `task`, `target_files` |
| `code_apply` | Apply edits + verify | `project_name`, `edits`, `verify` |
| `watch_project` | Auto re-index on change | `project_name` |
| `unwatch_project` | Stop watching | `project_name` |
| `benchmark_search` | Performance benchmark | `project_name`, `runs` |
| `chat_context` | Chat memory (save/load/clear/ingest) | `action`, `project_name`, `semantic_query` |

## Search Modes

| Mode | Use When | Speed |
|------|----------|-------|
| `keyword` | Exact identifiers, file paths, short queries | ⚡ Fastest |
| `semantic` | Natural language, concepts, "how does X work" | 🐢 Slower (needs Ollama) |
| `hybrid` | Best of both — RRF fusion | ⚡⚡ Balanced (default) |
| `auto` | Let server decide based on query | ⚡ Auto |
| `regex` | Pattern matching `/pattern/flags` | ⚡ Fast |
| `symbol` | Symbol name lookup in SQLite | ⚡⚡ Very fast |

### Key Search Params
`limit` (10) · `dedupe_by_file` (true) · `expand_context` (0-5) · `file_pattern` (glob) · `symbol_kind` · `language` · `content_mode` · `explain` · `rerank`

## Streaming Search (v0.9.0)

Add `stream=true` for parallel keyword+semantic via Promise.all — ~1.5-2x faster total time. Enable globally: `SEARCH_STREAM_ENABLED=true`.

## Fuzzy Search (v0.8.1)

Add `fuzzy=true` to auto-correct typos via Levenshtein. `"fucntion"` → `"function"`.

---

## 🧠 Chat Memory (v0.12.0)

Hybrid storage: **SQLite** (full text) + **Qdrant** (vector embeddings). Auto-track + semantic search.

### Architecture
```
SAVE:  entry → SQLite (sync) + Ollama embed() → Qdrant (background, fire-and-forget)
LOAD:  semantic_query → embed → Qdrant search(top-K) → SQLite fetch by ID
       (no semantic_query) → SQLite chronological
```

### Auto-Track (NO manual tool call needed)
When `CHAT_MEMORY_ENABLED=true`, these tool calls auto-log to chat memory:
- `search` → query + mode + top result files + scores
- `smart_context` → task/question + gathered file paths
- `code_session` → task + core files + test files + session ID

### chat_context Actions

**ingest** — Dump full conversation at session end:
```
chat_context(action="ingest", project_name="my-project",
  title="Fix login bug",
  messages=[
    { role: "user", content: "fix login bug in auth.ts" },
    { role: "assistant", content: "Found the bug in token validation..." }
  ])
```

**save** — Save a single important message:
```
chat_context(action="save", project_name="my-project",
  role="assistant", content="Decision: we should use JWT with refresh tokens")
```

**load** — Load context:
```
# Chronological — "what were we working on?"
chat_context(action="load", project_name="my-project", limit=20)

# Semantic — "anything about auth rate limiting?"
chat_context(action="load", project_name="my-project",
  semantic_query="auth rate limiting middleware")
# Embed query → Qdrant search → SQLite by ID. Only returns relevant entries.
# Falls back to chronological if Ollama/Qdrant are unavailable.
```

**clear** — Delete old entries:
```
chat_context(action="clear", project_name="my-project", max_age_hours=168)
```

### Resource: knowledge://context/{project}
AI clients auto-read on startup → previous context available immediately. No tool call, no re-searching.

### Session Lifecycle (Recommended)
```
START:  Resource auto-loads context. Optionally: chat_context(action="load") for detail.
DURING: Auto-tracked (no action). Optionally: chat_context(action="save") for key notes.
END:    chat_context(action="ingest", messages=[entire conversation])
```

### Chat Memory Env Vars
| Var | Default | |
|-----|---------|---|
| `CHAT_MEMORY_ENABLED` | `false` | **Master switch** — must be true for any feature |
| `CHAT_MEMORY_VECTOR_ENABLED` | `true` | Qdrant semantic search. Set false for SQLite-only |
| `CHAT_MEMORY_LOAD_LIMIT` | `20` | Max entries per load |
| `CHAT_MEMORY_MAX_AGE_HOURS` | `168` | Only load entries within 7 days |
| `CHAT_MEMORY_THREAD_TTL_MS` | `3600000` | Reuse latest thread if within 1 hour |

---

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

### Chat Memory
- **Ingest at session end** — dump once, not after every message
- **Semantic for specific topics** — use when looking for past discussions on a topic
- **Chronological for resuming** — use when resuming a session
- **Clear periodically** — entries > 7-30 days to keep DB lean

## Key Env Vars

| Var | Default | Purpose |
|-----|---------|---------|
| `OLLAMA_URL` | localhost:11434 | Ollama server |
| `OLLAMA_MODEL` | bge-m3:567m | Embedding model |
| `QDRANT_URL` | localhost:6333 | Qdrant vector DB |
| `QDRANT_API_KEY` | (none) | Qdrant Cloud API key |
| `STORAGE_PATH` | ~/.vibe-hnindex | SQLite path |
| `SEARCH_STREAM_ENABLED` | false | Global stream mode |
| `SEARCH_FUZZY_ENABLED` | false | Global fuzzy mode |
| `SEARCH_AUTO_ROUTE` | false | Auto-select search mode |
| `SEARCH_CACHE_SIZE` | 100 | LRU cache entries |
| `SEARCH_CACHE_TTL_MS` | 300000 | Cache TTL (5 min) |
| `INDEX_WORKERS` | auto | Parallel indexing workers |
| `CODE_AGENT_ENABLED` | false | Enable code_session + code_apply |
| `CODE_AGENT_SCOPE` | moderate | safe / moderate / full |
| `WATCH_AUTO_RESUME` | true | Auto-resume file watching |
| `CHAT_MEMORY_ENABLED` | false | Enable chat memory |
| `CHAT_MEMORY_VECTOR_ENABLED` | true | Qdrant vectors for chat |
| `CHAT_MEMORY_LOAD_LIMIT` | 20 | Max entries per load |
| `CHAT_MEMORY_MAX_AGE_HOURS` | 168 | Context age limit (7 days) |
| `CHAT_MEMORY_THREAD_TTL_MS` | 3600000 | Thread reuse window (1 hour) |

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

### Understand Code Flow (v0.10.0)
```
→ smart_context(project_name="my-project", question="how does auth flow work?")
→ smart_context(project_name="my-project", file_path="src/api.ts", task="refactor")
```

### Code Agent — 2-Call (v0.11.0) ⚡
```
→ code_session(project_name="my-project", task="add rate limiting")
  // Returns: files + patterns + deps + tests + impact
→ code_apply(project_name="my-project", edits=[...], verify=true)
  // Applies changes + runs tests + lint + typecheck
```

### Impact Before Refactor
```
→ impact_analysis(project_name="my-project", file_path="src/auth/service.ts", depth=3)
→ smart_context(project_name="my-project", file_path="src/auth.ts", task="refactor")
```

### Session with Memory (v0.12.0) 🧠
```
START:  (knowledge://context/my-project auto-loads)
→ search(query="middleware", stream=true)     // auto-tracked
→ smart_context(task="add rate limit")         // auto-tracked
END:
→ chat_context(action="ingest", project_name="my-project", messages=[...])
```
