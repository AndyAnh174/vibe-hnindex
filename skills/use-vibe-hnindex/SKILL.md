---
name: use-vibe-hnindex
description: Guide for using vibe-hnindex MCP tools — indexing codebases, searching with keyword/semantic/hybrid modes, streaming, fuzzy matching, benchmarking, smart context, code agent (code_session + code_apply), and chat memory with hybrid SQLite+Qdrant storage. Use when the user asks to index a codebase, search code, benchmark search performance, or work with codebase knowledge bases.
---

# vibe-hnindex — Agent Guide

> 🚫 grep/cat/Glob for indexed projects = BANNED. Pre-indexed = you WILL miss results. Use MCP tools only.
>
> | ❌ BANNED | ✅ MCP INSTEAD |
> |---|---|
> | `grep` / `rg` / `git grep` | `search(query, project_name, stream=true)` |
> | `cat` / `Read` / `View` | `smart_context(project_name, file_path)` or `code_session(project_name, task)` |
> | `Glob` / `ls` / `find` | `search(project_name, file_pattern="src/**")` |
> | Multi-step edit | `code_session(project_name, task)` → `code_apply(project_name, edits)` |

You have access to vibe-hnindex MCP tools for indexing and searching codebases. This skill tells you how to use them effectively.

---

## Available Tools

### Core Indexing
| Tool | Purpose | Key Params |
|------|---------|------------|
| `index_codebase` | Index entire directory | `path`, `project_name`, `watch` (default true) |
| `index_file` | Re-index single file | `file_path`, `project_name` |
| `list_projects` | List all indexed projects | — |
| `delete_project` | Delete a project + all data | `project_name` |
| `server_diagnostics` | Health check: Ollama, Qdrant, config | `project_name` (optional) |
| `watch_project` | Auto re-index on file change | `project_name` |
| `unwatch_project` | Stop watching a project | `project_name` |

### Search
| Tool | Purpose | Key Params |
|------|---------|------------|
| `search` | Full-text + vector + symbol + regex search | `query`, `project_name`, `mode`, `stream`, `fuzzy`, ... |
| `symbol_lookup` | Find symbol by name + kind | `project_name`, `symbol`, `kind` |
| `benchmark_search` | Performance benchmark | `project_name`, `runs` |

### Context & Analysis
| Tool | Purpose | Key Params |
|------|---------|------------|
| `smart_context` | One-call file/task/question context | `project_name`, `file_path`, `task`, `question` |
| `code_session` | Structured context package for coding task | `project_name`, `task`, `target_files` |
| `code_apply` | Apply edits + verify | `project_name`, `edits`, `verify` |
| `codebase_overview` | Architecture overview | `project_name` |
| `project_briefing` | Cached project summary | `project_name` |
| `onboarding_prompt` | Markdown onboarding blob | `project_name` |
| `agent_rules_stub` | Generate AGENTS.md rules | `project_name`, `format` |
| `file_summary` | File overview with exports | `project_name`, `file_path` |
| `get_file_info` | File chunk details | `file_path`, `project_name` |
| `get_dependencies` | Imports of a file | `project_name`, `file_path` |
| `get_dependents` | Files that import this file | `project_name`, `file_path` |
| `impact_analysis` | Transitive dependency impact | `project_name`, `file_path`, `depth` |
| `recent_changes` | Recent git commits | `project_name`, `days`, `limit` |
| `project_stats` | Stats breakdown | `project_name` |

### Chat Memory (v0.12.0) 🧠
| Tool | Purpose | Key Params |
|------|---------|------------|
| `chat_context` | Save/load/clear/ingest chat memory | `action`, `project_name`, `semantic_query`, ... |

---

## Search Modes

| Mode | Use When | Speed |
|------|----------|-------|
| `keyword` | Exact identifiers, file paths, short queries | ⚡ Fastest |
| `semantic` | Natural language, concepts, "how does X work" | 🐢 Slower (needs Ollama) |
| `hybrid` | Best of both — RRF fusion | ⚡⚡ Balanced (default) |
| `auto` | Let server decide based on query | ⚡ Auto (needs `SEARCH_AUTO_ROUTE`) |
| `regex` | Pattern matching `/pattern/flags` | ⚡ Fast |
| `symbol` | Symbol name lookup in SQLite | ⚡⚡ Very fast |

### Key Search Params
- `limit` (default 10, max 50) — Results to return
- `dedupe_by_file` (default true) — One result per file
- `expand_context` (0-5) — Adjacent chunks before/after each result
- `file_pattern` — Glob filter: `"src/auth/**"`, `"*.ts"`
- `symbol_kind` — Filter by: `function`, `class`, `method`, `interface`, `type`, `variable`, `enum`, `export`
- `language` — Filter: `typescript`, `python`, `go`, `rust`, `java`, etc.
- `content_mode` — `compact` (truncated, default) or `full` (entire chunk text)
- `max_content_chars` — Max chars per chunk body in compact mode
- `deprioritize_generated_paths` (default true) — Down-rank `node_modules`, `dist`, `build`, etc.
- `explain` (default false) — Include score breakdown in output
- `rerank` — When false, skip post-retrieval reorder

### Performance Features
- **`stream: true`** (v0.9.0) — Parallel keyword + semantic via Promise.all. ~1.5-2x faster. NOT just TTFB — actual total time reduction. Use always for hybrid/semantic.
- **`fuzzy: true`** (v0.8.1) — Levenshtein auto-correct. `"fucntion"` → `"function"`. `"libery"` → `"library"`.
- **Cache** — LRU, 5min TTL by default. Identical queries hit cache in ~5ms.

---

## Workflows

### Setup & First Search
```
1. index_codebase(path="/project/dir", project_name="my-project")
2. search(query="authentication", project_name="my-project", stream=true)
```

### Find Code by Concept
```
search(query="how does token validation work", project_name="my-project", mode="hybrid", stream=true)
```

### Smart Context — Task-Aware (v0.10.0)
Use for understanding code, debugging, or exploring before making changes.

```
// File + task: gets file content, deps, impact analysis, test files, similar patterns
smart_context(project_name="my-project", file_path="src/auth.ts", task="refactor to add rate limiting")

// Question: auto-searches relevant code, gathers full context for Q&A
smart_context(project_name="my-project", question="how does auth flow work?")

// File only: basic file info + imports + dependents + exports
smart_context(project_name="my-project", file_path="src/auth.ts")
```

### Find All Implementations
```
symbol_lookup(project_name="my-project", symbol="AuthService", kind="class")
get_dependents(project_name="my-project", file_path="src/auth/service.ts")
```

### Check Impact Before Refactoring
```
impact_analysis(project_name="my-project", file_path="src/auth.ts", depth=3)
// Returns transitive dependents up to depth 3
```

### Code Agent — 2-Call Workflow (v0.11.0) ⚡
For actually making changes. Replaces 5-15 separate search+read calls.

**Step 1 — Gather context:**
```
code_session(
  project_name="my-project",
  task="add rate limiting middleware to Express API",
  target_files=["src/api/auth.ts"]  // optional: focus on specific files
)
// Returns structured JSON:
//   task_analysis: { detected_type, keywords, relevant_dirs }
//   core_files: [{ path, content, language, exports, imports }]
//   similar_patterns: [{ path, snippet, relevance }]
//   dependencies: { installed, relevant }
//   test_files: [{ path }]
//   project_structure: { framework, test_framework, typescript }
//   impact: { affected_files, dependents_count }
//   session_data: { session_id, collected_files, total_context_bytes }
```

**Step 2 — Apply changes:**
```
code_apply(
  project_name="my-project",
  session_id="cs_xxx",  // from step 1
  edits=[
    { action: "create", file_path: "src/middleware/rate-limit.ts", content: "// new file..." },
    { action: "modify", file_path: "src/auth.ts", content: "// modified file..." },
    { action: "delete", file_path: "src/old-middleware.ts" }
  ],
  verify=true  // auto-run tests + lint + typecheck (default true)
)
// Actions: create (new file), modify (update), delete.
// Scope: CODE_AGENT_SCOPE env → safe | moderate | full
// Returns: { status, changes[], test_output, lint_output, typecheck_output }
```

**When to use code_agent vs smart_context:**
- `code_agent` → actually making changes, refactoring, implementing features
- `smart_context` → understanding code, debugging questions, exploring

### Benchmark Performance
```
benchmark_search(project_name="my-project", runs=3)
// Runs multiple search queries, compares streaming vs non-streaming timing
// Reports: avg/min/max time, result counts, speedup ratios
```

---

## 🧠 Chat Memory System (v0.12.0)

### Overview

Hybrid storage: **SQLite** (full text, chronological) + **Qdrant** (vector embeddings, semantic search). Every `search`, `smart_context`, and `code_session` call is **automatically logged** — no manual tool call needed. AI restarts sessions with full context from previous work, without re-searching from scratch.

### Architecture

```
SAVE:
  entry ──► SQLite (sync, always works)
        └─► Ollama embed() ──► Qdrant (fire-and-forget, doesn't block)

LOAD (chronological):
  SQLite ──► all recent entries by time

LOAD (semantic):
  query ──► Ollama embed() ──► Qdrant search(top-K) ──► SQLite fetch by ID
                                                                      │
                                                  only relevant entries, saves tokens
```

### Auto-Track (NO manual tool call)

These tools automatically log to chat memory when `CHAT_MEMORY_ENABLED=true`:

| Tool | What gets logged |
|------|-----------------|
| `search` | Query + mode + top result files + scores |
| `smart_context` | Task/question + file paths gathered |
| `code_session` | Task + core files + test files + session ID |

### chat_context Tool — All Actions

```
chat_context(
  action: "save" | "load" | "clear" | "ingest" | "resource",
  project_name: string,
  // ... action-specific params below
)
```

#### action: "save" — Save a single message
```
chat_context(
  action="save",
  project_name="my-project",
  role="assistant",           // "user" or "assistant"
  content="Found the bug: the token validation was using the wrong secret key...",
  thread_id="ct_abc123"       // optional — reuse existing thread
)
// Returns: { threadId, entryId }
```

#### action: "ingest" — Ingest full conversation
Call this ONCE at session end to dump the entire conversation into memory. All messages are embedded and stored in Qdrant in the background.

```
chat_context(
  action="ingest",
  project_name="my-project",
  title="Fix login bug — June 2026",     // optional thread title
  messages=[
    { role: "user",    content: "có bug ở login, sửa giúp tui" },
    { role: "assistant", content: "Để tôi search auth module..." },
    { role: "user",    content: "ok đúng rồi, còn gì nữa không?" },
    { role: "assistant", content: "Còn phải update tests nữa..." }
  ]
)
// Returns: { threadId, count: 4 }
```

#### action: "load" — Load context

**Chronological load** (default):
```
chat_context(
  action="load",
  project_name="my-project",
  limit=20,                // max entries (default 20, max 100)
  max_age_hours=168,       // only entries within 7 days
  thread_id="ct_abc123"    // optional — filter by thread
)
```

**Semantic load** (saves tokens — only returns relevant entries):
```
chat_context(
  action="load",
  project_name="my-project",
  semantic_query="auth token validation middleware",
  limit=10,
  thread_id="ct_abc123"    // optional
)
// Flow: embed "auth token..." → Qdrant search → SQLite fetch by ID
// Only returns entries that are semantically similar to the query
// Falls back to chronological load if Ollama/Qdrant are unavailable
```

#### action: "clear" — Delete old context
```
chat_context(
  action="clear",
  project_name="my-project",
  max_age_hours=168,       // delete entries older than 7 days
  thread_id="ct_abc123"    // optional — delete only from this thread
)
// Returns: { deleted: number }
// Also cleans up Qdrant vectors for deleted entries
```

#### action: "resource" — Get context summary
```
chat_context(
  action="resource",
  project_name="my-project"
)
// Returns a formatted summary of all threads + recent entries
// Same output as the knowledge://context/{project} resource
```

### Resource: knowledge://context/{project}

AI clients automatically read this resource on session startup. No tool call needed — context is immediately available.

```
// AI reads: knowledge://context/my-project
// Returns formatted summary:
//   ## Chat Context for "my-project"
//   ### Fix login bug (4 msgs, 1200 chars, updated 2026-06-16)
//     👤 User: có bug ở login, sửa giúp tui
//     🛠 system [tool: search]: [keyword] "auth module" → 5 results
//     🤖 AI [tool: smart_context]: [smart_context] task="fix bug" → 3 files
//     👤 User: ok đúng rồi
```

### When to Use Which Load Mode

| Scenario | Use |
|----------|-----|
| "What were we working on?" | `chat_context(action:"load")` — chronological |
| "Anything about auth rate limiting?" | `chat_context(action:"load", semantic_query="auth rate limiting")` — semantic |
| First session of the day | Resource `knowledge://context/{project}` — auto-load |
| End of session | `chat_context(action:"ingest", messages=[...])` — dump conversation |

### Session Lifecycle (Recommended Pattern)

```
SESSION START:
  → AI reads knowledge://context/{project} automatically
  → (Optional) chat_context(action:"load", limit=10) for more detail

DURING SESSION:
  → search / smart_context / code_session → auto-tracked (no action needed)
  → (Optional) chat_context(action:"save", role="user", content="...")
      for important user notes/decisions

SESSION END:
  → chat_context(action:"ingest", messages=[entire conversation])
  → (Optional) chat_context(action:"clear", max_age_hours=720) for cleanup
```

---

## Environment Variables

### Required Infrastructure
| Var | Default | Purpose |
|-----|---------|---------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server (embeddings) |
| `OLLAMA_MODEL` | `bge-m3:567m` | Embedding model |
| `EMBEDDING_DIMENSIONS` | `1024` | Vector size — must match model output |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant vector DB |
| `QDRANT_API_KEY` | (none) | Qdrant Cloud API key |
| `STORAGE_PATH` | `~/.vibe-hnindex` | SQLite database path |

### Search Configuration
| Var | Default | Purpose |
|-----|---------|---------|
| `SEARCH_AUTO_ROUTE` | `false` | Auto-select search mode from query |
| `SEARCH_KEYWORD_FALLBACK_SEMANTIC` | `true` | Semantic fallback when keyword returns 0 |
| `SEARCH_RERANK` | `true` | Post-retrieval reorder (reranker or semantic) |
| `SEARCH_RERANK_POOL` | `50` | Max results before rerank trim |
| `SEARCH_STREAM_ENABLED` | `false` | Enable streaming for all searches |
| `SEARCH_FUZZY_ENABLED` | `false` | Enable fuzzy for all searches |
| `SEARCH_CACHE_SIZE` | `100` | LRU cache entries |
| `SEARCH_CACHE_TTL_MS` | `300000` | Cache TTL in ms (5 min) |
| `SEARCH_TIMEOUT_MS` | `60000` | Overall search timeout |
| `RERANK_URL` | (none) | External reranker POST URL |
| `RERANK_TIMEOUT_MS` | `15000` | Reranker request timeout |

### Indexing
| Var | Default | Purpose |
|-----|---------|---------|
| `INDEX_WORKERS` | auto | Worker threads (auto = CPU-1, 0 = auto) |
| `INDEX_PARALLEL_BATCH` | `8` | Files per worker batch |
| `CHUNK_SIZE` | `60` | Lines per chunk |
| `CHUNK_OVERLAP` | `5` | Overlap lines between chunks |
| `MAX_FILE_SIZE` | `1048576` | Max file size in bytes (1MB) |
| `WATCH_AUTO_RESUME` | `true` | Auto-resume file watching on restart |

### Timeouts
| Var | Default | Purpose |
|-----|---------|---------|
| `OLLAMA_TIMEOUT_MS` | `30000` | Ollama API timeout |
| `QDRANT_TIMEOUT_MS` | `15000` | Qdrant API timeout |

### Code Agent
| Var | Default | Purpose |
|-----|---------|---------|
| `CODE_AGENT_ENABLED` | `false` | Enable code_session + code_apply |
| `CODE_AGENT_SCOPE` | `moderate` | `safe` (read-only) \| `moderate` \| `full` |
| `SMART_CONTEXT_MAX_FILE_CHARS` | `25000` | Max chars per file in smart_context (0 = unlimited) |

### Chat Memory (v0.12.0)
| Var | Default | Purpose |
|-----|---------|---------|
| `CHAT_MEMORY_ENABLED` | `false` | **Master switch** — enables all chat memory features |
| `CHAT_MEMORY_VECTOR_ENABLED` | `true` | Enable Qdrant vector storage (semantic search). Set `false` for SQLite-only mode if Ollama/Qdrant are unavailable. |
| `CHAT_MEMORY_LOAD_LIMIT` | `20` | Max entries per load (chronological or semantic) |
| `CHAT_MEMORY_MAX_AGE_HOURS` | `168` | Max age in hours (7 days) — older entries are ignored on load |
| `CHAT_MEMORY_THREAD_TTL_MS` | `3600000` | Reuse latest thread if within 1 hour, else create new |

### Chat Memory — Minimal Setup
```bash
# Bare minimum to enable chat memory
CHAT_MEMORY_ENABLED=true

# SQLite-only mode (no Ollama/Qdrant needed for chat memory)
CHAT_MEMORY_VECTOR_ENABLED=false

# Full mode (recommended for semantic search)
CHAT_MEMORY_ENABLED=true
CHAT_MEMORY_VECTOR_ENABLED=true   # default — requires Ollama + Qdrant
```

### Chat Memory — Advanced Tuning
```bash
# Keep context for 30 days
CHAT_MEMORY_MAX_AGE_HOURS=720

# Load up to 50 entries at a time
CHAT_MEMORY_LOAD_LIMIT=50

# Start new thread after 30 min of inactivity (more granular sessions)
CHAT_MEMORY_THREAD_TTL_MS=1800000
```

---

## Best Practices

### Searching
1. **Narrow first** — use `file_pattern` to scope, then widen
2. **Small limit** — start with `limit=5-10`, increase if needed
3. **Dedupe** — keep `dedupe_by_file=true` (default) for diverse results
4. **Expand context** — use `expand_context=1-2` to see surrounding code
5. **Stream** — always use `stream=true` for better UX on hybrid/semantic
6. **Cache is automatic** — second identical search returns in ~5ms

### Indexing
1. **First time** — index is slow (embeddings via Ollama), be patient
2. **Re-index** — only changed files are re-processed (hash-based incremental)
3. **Watch** — `watch=true` (default) auto re-indexes on file save
4. **Large projects** — increase `INDEX_PARALLEL_BATCH` for more throughput

### Chat Memory
1. **Ingest at session end** — dump entire conversation once, not after every message
2. **Use semantic load** — when looking for specific past discussions, not general context
3. **Use chronological load** — when resuming a session, to see everything in order
4. **Clear old context** — periodically clear entries > 7-30 days to keep DB lean
5. **Resource on startup** — AI clients auto-read it; don't call load manually on startup
6. **Thread TTL** — adjust `CHAT_MEMORY_THREAD_TTL_MS` to match your work patterns (short sessions = lower TTL)

---

## Prerequisites

- **Ollama** (for semantic search + embeddings):
  ```bash
  ollama serve
  ollama pull bge-m3:567m
  ```
- **Qdrant** (for vector storage):
  ```bash
  docker run -d -p 6333:6333 qdrant/qdrant
  ```
- **Node.js** >= 20 (for vibe-hnindex CLI)
