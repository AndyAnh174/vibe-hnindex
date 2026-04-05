# vibe-hnindex

> MCP Server that turns AI assistants into "codebase-aware" helpers — index source code into a local knowledge base, search with keyword + semantic + hybrid modes.

[![npm version](https://img.shields.io/npm/v/vibe-hnindex.svg)](https://www.npmjs.com/package/vibe-hnindex)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/github/stars/AndyAnh174/vibe-hnindex?style=social)](https://github.com/AndyAnh174/vibe-hnindex)

## About

`vibe-hnindex` is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that runs locally on your machine. It allows AI assistants (Claude, Cursor, Windsurf, Google Antigravity...) to **index your entire codebase** into a knowledge base and **search it anytime** — even across chat sessions.

**No cloud. No API keys. 100% local data.**

**Status:** This project is in early development (v0.1.x). Expect breaking changes and new features in upcoming releases. Feedback and contributions are welcome!

### Use Cases

- **Onboard a new repo** — index once, ask "how does the auth flow work?" and get exact files + line numbers
- **Fast debugging** — "find where the payment API is called" with semantic understanding (better than grep)
- **Cross-session memory** — index today, search next week in a brand new chat

## Features

- **Keyword search** — SQLite FTS5 + BM25 ranking
- **Semantic search** — Qdrant vector similarity + bge-m3 embeddings (1024-dim)
- **Hybrid search** — combines both using Reciprocal Rank Fusion (RRF)
- **Smart chunking** — splits code at natural boundaries (function/class), 5-line overlap
- **Incremental indexing** — SHA-256 hash check, only re-indexes changed files
- **40+ languages** — TypeScript, Python, Go, Rust, Java, C#, PHP, Ruby, Dart, Solidity...
- **Graceful degradation** — keyword search still works when Qdrant/Ollama is down

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  AI Client (Claude / Cursor / Windsurf / Antigravity)    │
│  Calls MCP tools: index_codebase, search, list_projects  │
└────────────────────────┬─────────────────────────────────┘
                         │ JSON-RPC (stdio)
┌────────────────────────▼─────────────────────────────────┐
│  vibe-hnindex (MCP Server)                               │
│                                                          │
│  File Scanner → Chunker → Ollama Embeddings              │
│       ↓              ↓            ↓                      │
│  ┌──────────┐  ┌──────────┐                              │
│  │  SQLite   │  │  Qdrant  │                              │
│  │  FTS5     │  │  Vectors │                              │
│  └──────────┘  └──────────┘                              │
└──────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### 1. Node.js >= 20

```bash
node -v
```

### 2. Ollama (embedding server)

```bash
# Install: https://ollama.com/download
ollama pull bge-m3:567m
ollama serve
```

Or use a remote Ollama server: set `OLLAMA_URL=http://your-server:11434`

### 3. Qdrant (vector database)

```bash
docker run -d --name qdrant -p 6333:6333 -v qdrant_storage:/qdrant/storage qdrant/qdrant
```

> **Note:** Keyword search works **without** Qdrant. Qdrant is only required for semantic/hybrid search.

---

## Quick Start

### 1. Add to your AI tool's MCP config

```json
{
  "mcpServers": {
    "vibe-hnindex": {
      "command": "npx",
      "args": ["-y", "vibe-hnindex"],
      "env": {
        "OLLAMA_URL": "http://localhost:11434",
        "OLLAMA_MODEL": "bge-m3:567m",
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}
```

### 2. Restart your AI tool

### 3. In chat, just ask:

```
"Index the codebase at D:/projects/my-app, name it my-app"
→ Indexes all source files

"Search my-app for authentication middleware"
→ Returns matching code chunks with file paths and line numbers

"List all indexed projects"
→ Shows what's been indexed
```

---

## Integration

### Claude Code CLI

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "vibe-hnindex": {
      "command": "npx",
      "args": ["-y", "vibe-hnindex"],
      "env": {
        "OLLAMA_URL": "http://localhost:11434",
        "OLLAMA_MODEL": "bge-m3:567m",
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}
```

```bash
cd /path/to/your-project && claude
```

### Claude Desktop

Edit `claude_desktop_config.json`:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Same JSON format as above.

### Google Antigravity

Edit `mcp_config.json`:
- **Windows:** `C:\Users\<USER>\.gemini\antigravity\mcp_config.json`
- **macOS / Linux:** `~/.gemini/antigravity/mcp_config.json`

Or in Antigravity: **3-dot menu > MCP > Manage MCP Servers > View raw config**

Same JSON format as above.

### Cursor

Create `.cursor/mcp.json` in project root, or configure globally:
- **Windows:** `%APPDATA%\Cursor\User\globalStorage\cursor.mcp\mcp.json`
- **macOS / Linux:** `~/.cursor/mcp.json`

Same JSON format.

### Windsurf

Edit `~/.windsurf/mcp_config.json` (same path on macOS, Linux, and Windows). Same JSON format.

### VS Code (Copilot)

Create `.vscode/mcp.json` in project root:

```json
{
  "servers": {
    "vibe-hnindex": {
      "command": "npx",
      "args": ["-y", "vibe-hnindex"],
      "env": {
        "OLLAMA_URL": "http://localhost:11434",
        "OLLAMA_MODEL": "bge-m3:567m",
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}
```

---

## Tools

### `index_codebase`

Index an entire directory. Supports incremental re-indexing.

```
index_codebase(path: "/path/to/project", project_name: "my-app")
```

### `index_file`

Index or re-index a single file. Project must already exist.

```
index_file(file_path: "/path/to/file.ts", project_name: "my-app")
```

### `search`

Search indexed code with 3 modes:

| Mode | How it works | Best for |
|------|-------------|----------|
| `keyword` | SQLite FTS5 + BM25 | Exact function/variable names |
| `semantic` | Qdrant cosine similarity | Natural language queries |
| `hybrid` | RRF fusion (recommended) | Best overall results |

```
search(query: "authentication middleware", project_name: "my-app", mode: "hybrid", limit: 10)
```

### `list_projects`

List all indexed projects with metadata.

### `delete_project`

Remove a project from the knowledge base (SQLite + Qdrant).

```
delete_project(project_name: "my-app")
```

### `get_file_info`

Get info about a specific indexed file (chunks, line ranges, language).

```
get_file_info(file_path: "src/index.ts", project_name: "my-app")
```

---

## Configuration

All settings via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `bge-m3:567m` | Embedding model name |
| `STORAGE_PATH` | `~/.vibe-hnindex` | SQLite database location |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `QDRANT_COLLECTION_PREFIX` | `mcp_ck_` | Qdrant collection name prefix |
| `CHUNK_SIZE` | `60` | Target lines per chunk |
| `CHUNK_OVERLAP` | `5` | Overlap lines between chunks |
| `MAX_FILE_SIZE` | `1048576` | Max file size in bytes (default 1MB) |

---

## How It Works

### Indexing Pipeline

```
Scan directory → filter files (40+ extensions, skip node_modules/.git/dist...)
  → SHA-256 hash → skip unchanged files
  → chunk code (60 lines, boundary-aware, 5-line overlap)
  → embed via Ollama bge-m3 (batch 32, 1024-dim vectors)
  → store in SQLite (text + FTS5) and Qdrant (vectors)
```

### Hybrid Search (RRF)

Runs keyword + semantic search in parallel, combines with Reciprocal Rank Fusion:

```
score(chunk) = 1/(60 + rank_keyword) + 1/(60 + rank_semantic)
```

Chunks appearing in both result sets get boosted scores.

### Data Storage

| Component | Location | Purpose |
|-----------|----------|---------|
| SQLite | `~/.vibe-hnindex/knowledge.db` | Chunk text, FTS5 index, project metadata |
| Qdrant | Docker volume `qdrant_storage` | Vector embeddings (1024-dim, cosine distance) |

Each project = 1 Qdrant collection named `mcp_ck_{project_name}`.

Data is **persistent** — survives across chat sessions and IDE restarts.

---

## Supported Languages

TypeScript, JavaScript, Python, Java, Go, Rust, C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala, Lua, Bash, SQL, Vue, Svelte, HTML, CSS, SCSS, YAML, TOML, JSON, XML, Markdown, Protocol Buffers, GraphQL, Terraform, Zig, Elixir, Erlang, Clojure, Haskell, OCaml, F#, Dart, Solidity, CMake, Gradle, Dockerfile, Makefile

**Auto-skipped:** `node_modules`, `.git`, `dist`, `build`, `__pycache__`, `vendor`, lock files, binary files, files > 1MB

---

## Error Handling

| Error | Behavior |
|-------|----------|
| Ollama down | Clear error message. Keyword search still works. |
| Qdrant down | Clear error message. Keyword search still works. |
| Hybrid mode + services down | Auto-fallback to keyword search + warning |
| File unreadable / too large / binary | Skip file, continue indexing, report in summary |

---

## Development

```bash
git clone https://github.com/AndyAnh174/vibe-hnindex.git
cd vibe-hnindex
npm install
npm run build
npm run dev   # run directly from source via tsx
```

### Project Structure

```
src/
├── index.ts                 # Entry point: MCP server + tool registration
├── config.ts                # Environment variables + defaults
├── types.ts                 # Shared TypeScript interfaces
├── services/
│   ├── sqlite.ts            # SQLite + FTS5: schema, CRUD, keyword search
│   ├── qdrant.ts            # Qdrant: collection management, vector search
│   ├── embeddings.ts        # Ollama API client (POST /api/embed)
│   ├── chunker.ts           # Smart line-based code chunker
│   └── file-scanner.ts      # Recursive directory walker + file filter
└── tools/
    ├── index-codebase.ts    # index_codebase handler
    ├── index-file.ts        # index_file handler
    ├── search.ts            # search handler (keyword/semantic/hybrid)
    ├── list-projects.ts     # list_projects handler
    ├── delete-project.ts    # delete_project handler
    └── get-file-info.ts     # get_file_info handler
```

---

## Roadmap

- [ ] Watch mode — auto re-index on file changes
- [ ] Search filters — by language, file path pattern
- [ ] AST-based chunking for better code understanding
- [ ] Web UI dashboard for managing indexed projects
- [ ] Support for more embedding models

---

## FAQ

**Where is data stored?**
SQLite: `~/.vibe-hnindex/knowledge.db`. Qdrant: Docker volume `qdrant_storage`.

**Does opening a new chat lose data?**
No. Data is persistent. Index once, search forever until you `delete_project`.

**Is Docker required?**
Qdrant needs Docker. Keyword search works without Docker/Qdrant.

**Can Ollama run on a different machine?**
Yes. Set `OLLAMA_URL=http://ip:port` in your MCP config env.

**Is re-indexing slow?**
No. Incremental indexing only processes files with changed SHA-256 hashes.

---

## License

MIT — see [LICENSE](LICENSE)

## Contributing

Issues and PRs are welcome at [github.com/AndyAnh174/vibe-hnindex](https://github.com/AndyAnh174/vibe-hnindex).

## Contact

- **Author:** Ho Viet Anh (AndyAnh174)
- **Email:** hovietanh147@gmail.com
- **GitHub:** [github.com/AndyAnh174](https://github.com/AndyAnh174)

If you have questions, suggestions, or want to report a bug, feel free to [open an issue](https://github.com/AndyAnh174/vibe-hnindex/issues) or reach out via email.
