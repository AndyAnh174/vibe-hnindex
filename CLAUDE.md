# CLAUDE.md — vibe-hnindex

## Project Overview

MCP Server that gives AI assistants (Claude, Cursor, Windsurf, Antigravity) a persistent knowledge base of source code. Index once, search anytime — across chat sessions.

**Core goals:**
1. Save tokens — AI gets precise results in 1 call instead of 10+ Read/Grep calls
2. Save time — AI finds exactly what it needs, doesn't wander through files
3. AI understands codebase — knows architecture, dependencies, what user is working on

## Tech Stack

- **TypeScript** (ESM, Node16 module resolution)
- **SQLite + FTS5** via `better-sqlite3` — chunk storage, keyword search (BM25)
- **Qdrant** via `@qdrant/js-client-rest` — vector storage, semantic search (cosine similarity)
- **Ollama** — embedding API (`POST /api/embed`), model `bge-m3:567m` (1024-dim)
- **MCP SDK** — `@modelcontextprotocol/sdk` with `server.tool()` + `server.resource()`

## Project Structure

```
src/
├── index.ts                 # Entry point: MCP server, tool registration, resource
├── config.ts                # Env vars + defaults (OLLAMA_URL, QDRANT_URL, etc.)
├── types.ts                 # Shared interfaces (ChunkRecord, SearchResult, etc.)
├── services/
│   ├── sqlite.ts            # SQLite + FTS5: schema, CRUD, keyword search, stats
│   ├── qdrant.ts            # Qdrant client: collections, vector upsert/search
│   ├── embeddings.ts        # Ollama API client (batch embed, health check)
│   ├── chunker.ts           # Smart line-based code chunker (boundary-aware)
│   └── file-scanner.ts      # Recursive dir walker, language detection, binary skip
└── tools/
    ├── index-codebase.ts    # Full directory indexing pipeline
    ├── index-file.ts        # Single file indexing (with path traversal protection)
    ├── search.ts            # 3 modes: keyword/semantic/hybrid (RRF), filters, context expansion
    ├── list-projects.ts     # List indexed projects
    ├── delete-project.ts    # Delete project from SQLite + Qdrant
    ├── get-file-info.ts     # File chunk details
    ├── project-stats.ts     # Language breakdown, file/chunk counts
    └── watch-project.ts     # fs.watch auto re-index on file save
tests/
├── chunker.test.ts
├── config.test.ts
├── file-scanner.test.ts
└── sqlite.test.ts
```

## Architecture

```
AI Client → JSON-RPC (stdio) → vibe-hnindex MCP Server
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              File Scanner     Chunker        Ollama Embed
                    │               │               │
                    ▼               ▼               ▼
              ┌──────────┐   ┌──────────┐
              │  SQLite   │   │  Qdrant  │
              │  FTS5     │   │  Vectors │
              └──────────┘   └──────────┘
```

- Each project = 1 Qdrant collection (`mcp_ck_{name}`)
- SQLite stores: chunks text, FTS5 index, project metadata
- Qdrant stores: 1024-dim vectors with cosine distance
- Data persistent at `~/.vibe-hnindex/knowledge.db`

## Key Design Decisions

- **Zod schemas passed as raw shape** to `server.tool()`, NOT `z.object()` wrapper
- **Logs via `console.error()`** — stdout reserved for JSON-RPC
- **Qdrant client uses `checkCompatibility: false`** — JS client v1.17 rejects server v1.15 otherwise
- **Graceful degradation** — keyword search works without Qdrant/Ollama; hybrid falls back to keyword
- **Incremental indexing** — SHA-256 file hash comparison, skip unchanged files
- **Batch embedding** — 32 chunks per Ollama API call

## Build & Test

```bash
# Build
node node_modules/typescript/bin/tsc

# Test (40 tests)
node node_modules/vitest/vitest.mjs run

# Note: on Windows, npx tsc / npx vitest may not work due to PATH issues
# Use direct node paths as shown above
```

## Important Conventions

- Entry point has shebang `#!/usr/bin/env node`
- All paths use forward slashes in DB (`.replace(/\\/g, '/')`)
- FTS5 sync via 3 triggers (INSERT/UPDATE/DELETE on chunks)
- Path traversal protection in index-file.ts (file must be inside project root)
- Symlink protection in file-scanner.ts (skip symlinks, verify resolved path)
- Watch mode cleans up on SIGINT/SIGTERM/exit

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| OLLAMA_URL | http://222.253.80.30:11434 | Ollama server |
| OLLAMA_MODEL | bge-m3:567m | Embedding model |
| STORAGE_PATH | ~/.vibe-hnindex | SQLite DB location |
| QDRANT_URL | http://localhost:6333 | Qdrant server |

## Publishing

- **npm**: `npm publish --ignore-scripts` (prepack uses `tsc || true`)
- **MCP Registry**: `mcp-publisher.exe publish` (server.json + mcpName in package.json)
- **Claude Plugin**: `.claude-plugin/marketplace.json` + `plugin.json`
- **GitHub Actions**: CI on push (Node 20/22/24), CD auto-publish npm on main merge

## Roadmap (v0.3.0)

### Priority 1: codebase_overview + file_summary
- Auto-generate project architecture summary from file structure + imports
- Per-file 1-2 sentence summary stored in DB
- AI gets full codebase understanding in 1 tool call (~200 tokens vs 2000+)

### Priority 2: Dependency graph + import_graph
- Parse import/export statements during indexing (TS/JS/Python/Go)
- New tables: `dependencies` (source → target + symbols), `exports` (file → symbols)
- New tools: `get_dependencies`, `get_exports`, `impact_analysis`
- AI knows "change function X affects files A, B, C" in 1 call

### Priority 3: recent_changes + smart_context
- Tool to show files changed recently (git-aware)
- Search returns compact results: function signature + summary instead of raw 60-line chunks
- Reduce tokens per search result by 70-80%

### Future
- Multi-project search
- Web UI dashboard
- Zero-dependency mode (in-memory vectors, no Docker)
- More embedding models (nomic-embed, mxbai-embed)
