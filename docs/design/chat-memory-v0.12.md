# Chat Memory System (v0.12.0)

## Overview

Hybrid persistent chat context for vibe-hnindex MCP server. AI agents (Claude, OpenClaw, etc.) that use vibe-hnindex tools can persist their working context across sessions — no more re-searching from scratch every time the agent restarts.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    AI Agent (Claude/OpenClaw)             │
│  ┌─────────┐  ┌──────────┐  ┌───────────────┐           │
│  │ search  │  │ smart_   │  │ code_session  │           │
│  │         │  │ context  │  │               │           │
│  └────┬────┘  └────┬─────┘  └───────┬───────┘           │
│       │            │                │                    │
│       └────────────┼────────────────┘                    │
│                    │ AUTO-TRACK (no tool call)            │
│                    ▼                                     │
│  ┌─────────────────────────────────────┐                 │
│  │        chat-memory.ts service       │                 │
│  │  ┌──────────┐    ┌───────────────┐  │                 │
│  │  │  SQLite  │    │    Qdrant     │  │                 │
│  │  │ (sync)   │    │  (background) │  │                 │
│  │  └──────────┘    └───────┬───────┘  │                 │
│  │                          │          │                 │
│  │                   Ollama embed()    │                 │
│  └─────────────────────────────────────┘                 │
│                                                          │
│  chat_context tool (manual control)                      │
│  ┌─────────────────────────────────────────┐             │
│  │ save │ load │ ingest │ clear │ resource │             │
│  └─────────────────────────────────────────┘             │
│                                                          │
│  Resource: knowledge://context/{project}                 │
│  ┌─────────────────────────────────────────┐             │
│  │ Auto-read on startup → context ready    │             │
│  └─────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────┘
```

## Storage: Hybrid SQLite + Qdrant

### Why Hybrid?

| Concern | SQLite | Qdrant |
|---------|--------|--------|
| Reliability | Always works (local file) | Depends on Qdrant being up |
| Speed (write) | Instant (sync) | Network round-trip |
| Token efficiency | Full text loaded → large context | Top-K by relevance → small context |
| Chronological | Natural ORDER BY | Must query with filters |
| Semantic search | Not supported | Native vector search |

**Design decision**: SQLite is the source of truth (sync, always works). Qdrant is a best-effort acceleration layer (fire-and-forget background embedding).

### SQLite Schema

```sql
CREATE TABLE chat_threads (
  id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  title TEXT,
  message_count INTEGER DEFAULT 0,
  total_chars INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE chat_context (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  source TEXT NOT NULL,  -- 'user-message' | 'ai-response' | 'tool-auto' | 'system'
  role TEXT NOT NULL,    -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  metadata TEXT,         -- JSON: { tool, query, files[], searchResults[], task, tags }
  created_at TEXT NOT NULL
);
```

### Qdrant Schema

Collection: `{QDRANT_COLLECTION_PREFIX}chat_{sanitized_project_name}` (e.g., `mcp_cc_my-project`)

Point payload:
```json
{
  "thread_id": "ct_xxx",
  "source": "tool-auto",
  "created_at": "2026-06-16T00:00:00Z"
}
```

Vector: content embedded via Ollama (`OLLAMA_MODEL`).

### Data Flow

**SAVE:**
```
entry → insertChatContext(SQLite) [sync]
     └→ embed(content) [async, fire-and-forget]
        └→ upsertChatPoints(Qdrant)
```

**LOAD (chronological):**
```
getChatContext(SQLite) → ORDER BY created_at DESC → return entries
```

**LOAD (semantic):**
```
semanticQuery → embedSingle(query) → searchChatSemantic(Qdrant)
             → getContextByIds(SQLite, ids[]) → return entries
```

## Auto-Track

### Hooked Tools

| Tool | What's logged | Source |
|------|--------------|--------|
| `search` | query + mode + top 5 result files + scores | `tool-auto` |
| `smart_context` | task/question + gathered file paths | `tool-auto` |
| `code_session` | task + core files + test files + session ID | `tool-auto` |

### Thread Resolution

- If `extra.sessionId` is provided by the MCP client → use it as thread ID
- Else, find the latest active thread for the project within `CHAT_MEMORY_THREAD_TTL_MS`
- If none found, create a new thread: `ct_{projectName}_{timestamp}`

## chat_context Tool

### Actions

| Action | Purpose | Params | Sync/Async |
|--------|---------|--------|------------|
| `save` | Save single message | `role`, `content` | Sync SQLite + async Qdrant |
| `ingest` | Dump full conversation | `messages[]`, `title?` | Sync SQLite + async Qdrant batch |
| `load` | Retrieve context | `limit?`, `max_age_hours?`, `semantic_query?` | Chronological: sync. Semantic: async |
| `clear` | Delete old entries | `max_age_hours?`, `thread_id?` | Sync SQLite + async Qdrant cleanup |
| `resource` | Get context summary | — | Sync |

### Semantic Load Fallback

If `semantic_query` is provided but Ollama or Qdrant is unavailable:
- Log warning to stderr
- Fall back to chronological load from SQLite
- Return `mode: "chronological"` in response

## Resource: knowledge://context/{project}

MCP resource auto-read by AI clients on session startup. Returns formatted markdown:

```
## Chat Context for "my-project"

### Fix login bug (4 msgs, 1200 chars, updated 2026-06-16)
  👤 User: fix login bug in auth.ts
  🛠 system [tool: search]: [keyword] "auth module" → 5 results
  🤖 AI [tool: smart_context]: [smart_context] task="fix bug" → 3 files
  👤 User: ok done
```

## Configuration

| Env Var | Default | Purpose |
|---------|---------|---------|
| `CHAT_MEMORY_ENABLED` | `false` | Master switch |
| `CHAT_MEMORY_VECTOR_ENABLED` | `true` | Enable Qdrant vector storage |
| `CHAT_MEMORY_LOAD_LIMIT` | `20` | Max entries per load |
| `CHAT_MEMORY_MAX_AGE_HOURS` | `168` | Context age limit (7 days) |
| `CHAT_MEMORY_THREAD_TTL_MS` | `3600000` | Thread reuse window (1 hour) |

## File Map

```
src/
├── types.ts                          # ChatThread, ChatContextEntry, ChatContextMetadata
├── config.ts                         # 5 chat memory env vars
├── index.ts                          # chat_context tool + resource registration
├── services/
│   ├── sqlite.ts                     # chat_threads + chat_context tables + CRUD
│   ├── qdrant.ts                     # chat memory collection + semantic search
│   ├── chat-memory.ts                # Core service: auto-track, save/load/clear/ingest
│   └── embeddings.ts                 # Reused: embedSingle(), embed() for Ollama
└── tools/
    ├── chat-context.ts               # MCP tool: chat_context action handler
    ├── search.ts                     # Auto-track hook in search results
    ├── smart-context.ts              # Auto-track hook in smart_context
    └── code-session.ts               # Auto-track hook in code_session
```

## Design Decisions

1. **Fire-and-forget Qdrant**: Embedding + Qdrant storage is async and non-blocking. If it fails, SQLite still has the full text. The entry is immediately available for chronological load.

2. **Source-of-truth = SQLite**: Qdrant is an acceleration layer, not a replacement. Entries are always in SQLite first. Qdrant is queried for IDs, then SQLite returns full content.

3. **Thread TTL for session continuity**: If the AI restarts within `CHAT_MEMORY_THREAD_TTL_MS` (default 1 hour), new tool calls go to the same thread. This groups related work naturally.

4. **Opt-in by default**: `CHAT_MEMORY_ENABLED=false` — users must explicitly enable it. This prevents unexpected DB growth and embedding costs.

5. **Semantic load = token-efficient**: Instead of loading all 20 most recent entries (which could be 5-10K tokens), semantic search returns only entries relevant to the current query.

## Future Improvements

- **Auto-summarization**: Periodically summarize threads to reduce storage
- **Cross-project context**: Search chat memory across multiple projects
- **Context pruning**: Auto-delete tool-auto entries older than N days (keep user/assistant messages)
- **Thread merging**: Merge related threads when they're semantically similar
