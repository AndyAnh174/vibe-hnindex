# vibe-hnindex

> MCP Server biến AI assistant thành "trợ lý hiểu sẵn codebase" — index source code vào knowledge base local, search bằng keyword + semantic + hybrid.

[![npm version](https://img.shields.io/npm/v/vibe-hnindex.svg)](https://www.npmjs.com/package/vibe-hnindex)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is this?

`vibe-hnindex` là một [MCP Server](https://modelcontextprotocol.io/) chạy trên máy local. Nó cho phép AI assistants (Claude, Cursor, Windsurf, Google Antigravity...) **index toàn bộ source code** vào knowledge base và **search lại bất cứ lúc nào** — kể cả ở chat session mới.

**Không cần cloud. Không cần API key. Data nằm 100% trên máy bạn.**

### Use cases

- **Onboard repo mới** → index 1 lần, hỏi "flow authentication hoạt động thế nào" → AI trả đúng file, đúng dòng
- **Debug nhanh** → "tìm chỗ nào gọi API payment" → hybrid search chính xác hơn grep
- **Cross-session** → hôm nay index, tuần sau mở chat mới vẫn query được

## Features

- **Keyword search** — SQLite FTS5 + BM25 ranking
- **Semantic search** — Qdrant vector similarity + bge-m3 embeddings (1024-dim)
- **Hybrid search** — kết hợp cả hai bằng Reciprocal Rank Fusion (RRF)
- **Smart chunking** — chia code theo boundary tự nhiên (function/class), overlap 5 lines
- **Incremental indexing** — SHA-256 hash check, chỉ re-index file thay đổi
- **40+ ngôn ngữ** — TypeScript, Python, Go, Rust, Java, C#, PHP, Ruby, Dart, Solidity...
- **Graceful degradation** — Qdrant down? Keyword search vẫn hoạt động

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  AI Client (Claude / Cursor / Windsurf / Antigravity)    │
│  Gọi MCP tools: index_codebase, search, list_projects... │
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

### 1. Node.js >= 18

```bash
node -v
```

### 2. Ollama (embedding server)

```bash
# Install: https://ollama.com/download
ollama pull bge-m3:567m
ollama serve
```

Hoặc dùng Ollama remote: set `OLLAMA_URL=http://your-server:11434`

### 3. Qdrant (vector database)

```bash
docker run -d --name qdrant -p 6333:6333 -v qdrant_storage:/qdrant/storage qdrant/qdrant
```

> Keyword search hoạt động **không cần** Qdrant. Qdrant chỉ cần cho semantic/hybrid search.

---

## Quick Start

### 1. Cấu hình MCP Server

Thêm vào config file của AI tool bạn dùng (xem chi tiết bên dưới):

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

### 2. Restart AI tool

### 3. Trong chat, nói:

```
"Index folder D:/projects/my-app tên là my-app"
→ AI gọi index_codebase, index toàn bộ codebase

"Tìm trong my-app phần xử lý authentication"
→ AI gọi search, trả code chunks liên quan

"Liệt kê project đã index"
→ AI gọi list_projects
```

---

## Integration (Config cho từng AI tool)

### Claude Code CLI

Tạo file `.mcp.json` ở root project:

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

### Google Antigravity

Edit `mcp_config.json`:
- **Windows:** `C:\Users\<USER>\.gemini\antigravity\mcp_config.json`
- **macOS:** `~/.gemini/antigravity/mcp_config.json`

Hoặc: **3-dot menu > MCP > Manage MCP Servers > View raw config**

Cùng format JSON như trên.

### Cursor

File `.cursor/mcp.json` ở root project hoặc global settings. Cùng format.

### Windsurf

File `~/.windsurf/mcp_config.json`. Cùng format.

### VS Code (Copilot)

File `.vscode/mcp.json` ở root project:

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

## Tools (6 MCP tools)

### `index_codebase`

Index toàn bộ folder. Hỗ trợ incremental (chỉ re-index file thay đổi).

```
index_codebase(path: "/path/to/project", project_name: "my-app")
```

### `index_file`

Index/re-index 1 file. Project phải tồn tại.

```
index_file(file_path: "/path/to/file.ts", project_name: "my-app")
```

### `search`

Tìm kiếm code. 3 mode:

| Mode | Mô tả | Khi nào dùng |
|------|--------|-------------|
| `keyword` | SQLite FTS5 + BM25 | Tìm chính xác tên hàm, biến |
| `semantic` | Qdrant cosine similarity | Tìm theo ý nghĩa |
| `hybrid` | RRF fusion (recommended) | Kết quả tốt nhất |

```
search(query: "authentication middleware", project_name: "my-app", mode: "hybrid", limit: 10)
```

### `list_projects`

Liệt kê tất cả project đã index.

### `delete_project`

Xóa project khỏi knowledge base (SQLite + Qdrant).

```
delete_project(project_name: "my-app")
```

### `get_file_info`

Xem thông tin 1 file đã index (chunks, line ranges).

```
get_file_info(file_path: "src/index.ts", project_name: "my-app")
```

---

## Configuration

| Variable | Default | Mô tả |
|----------|---------|-------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `bge-m3:567m` | Embedding model |
| `STORAGE_PATH` | `~/.vibe-hnindex` | SQLite database location |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `QDRANT_COLLECTION_PREFIX` | `mcp_ck_` | Prefix tên collection |
| `CHUNK_SIZE` | `60` | Lines per chunk |
| `CHUNK_OVERLAP` | `5` | Overlap lines between chunks |
| `MAX_FILE_SIZE` | `1048576` | Max file size (bytes, default 1MB) |

---

## How It Works

### Indexing

```
Scan directory → filter files (40+ extensions, skip node_modules/.git/dist...)
  → SHA-256 hash check → skip unchanged files
  → chunk code (60 lines, boundary-aware, 5-line overlap)
  → embed via Ollama bge-m3 (batch 32, 1024-dim vectors)
  → store in SQLite (text + FTS5) + Qdrant (vectors)
```

### Hybrid Search (RRF)

Chạy keyword + semantic song song, kết hợp bằng Reciprocal Rank Fusion:

```
score(chunk) = 1/(60 + rank_keyword) + 1/(60 + rank_semantic)
```

Chunks xuất hiện ở cả 2 danh sách được boost score.

### Data Storage

| Component | Location | Dùng cho |
|-----------|----------|---------|
| SQLite | `~/.vibe-hnindex/knowledge.db` | Chunks text, FTS5 index, metadata |
| Qdrant | Docker volume `qdrant_storage` | Vector embeddings (1024-dim, cosine) |

Mỗi project = 1 Qdrant collection tên `mcp_ck_{project_name}`.

Data **persistent** — mở chat mới, project mới vẫn search được.

---

## Supported Languages

TypeScript, JavaScript, Python, Java, Go, Rust, C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala, Lua, Bash, SQL, Vue, Svelte, HTML, CSS, SCSS, YAML, TOML, JSON, XML, Markdown, Protocol Buffers, GraphQL, Terraform, Zig, Elixir, Erlang, Clojure, Haskell, OCaml, F#, Dart, Solidity, CMake, Gradle, Dockerfile, Makefile

**Auto-skip:** `node_modules`, `.git`, `dist`, `build`, `__pycache__`, `vendor`, lock files, binary files, files > 1MB

---

## Error Handling

| Lỗi | Hành vi |
|-----|---------|
| Ollama down | Error message + keyword search vẫn hoạt động |
| Qdrant down | Error message + keyword search vẫn hoạt động |
| Hybrid + services down | Auto fallback về keyword + warning |
| File unreadable / >1MB / binary | Skip, continue, report in summary |

---

## Development

```bash
git clone https://github.com/YOUR_USERNAME/vibe-hnindex.git
cd vibe-hnindex
npm install
npm run build
npm run dev    # chạy trực tiếp từ source (tsx)
```

---

## FAQ

**Data lưu ở đâu?**
SQLite: `~/.vibe-hnindex/knowledge.db`. Qdrant: Docker volume `qdrant_storage`.

**Mở chat mới có mất data không?**
Không. Data persistent.

**Có cần Docker không?**
Qdrant cần Docker. Keyword search hoạt động không cần Docker.

**Ollama chạy ở máy khác được không?**
Được. Set `OLLAMA_URL=http://ip:port`.

**Index lại codebase có chậm không?**
Incremental — chỉ re-index file thay đổi (SHA-256 check).

---

## License

MIT License — see [LICENSE](LICENSE)

## Contributing

Issues and PRs welcome.
