<div align="center">

# vibe-hnindex

**Local MCP server for codebase indexing & hybrid search**

*Keyword (FTS5) · Semantic (Qdrant) · Hybrid (RRF) — no cloud API keys for your code*

[![npm](https://img.shields.io/npm/v/vibe-hnindex.svg?style=flat-square&logo=npm&label=npm)](https://www.npmjs.com/package/vibe-hnindex)
[![License](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-compatible-6366f1?style=flat-square)](https://modelcontextprotocol.io/)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)

**Current release: v0.4.0**

[Documentation](#documentation) · [Quick install](#quick-install) · [Features](#features) · [License](#license)

</div>

---

## Why vibe-hnindex

[vibe-hnindex](https://www.npmjs.com/package/vibe-hnindex) is a [Model Context Protocol](https://modelcontextprotocol.io/) server that runs on your machine. AI assistants (Claude, Cursor, Windsurf, Antigravity, …) can **index a repository once** and **search it in every session** — with file paths, line hints, and persistent storage.

Your source stays local; embeddings talk to **Ollama** and vectors to **Qdrant** (self-hosted or [Cloud](https://cloud.qdrant.io/) with `QDRANT_API_KEY`).

---

## Documentation

| Guide | What you’ll find |
|------|------------------|
| [Getting started](docs/getting-started.md) | Prerequisites, Ollama & Qdrant, MCP JSON (self-hosted & Cloud), first prompts |
| [Integrations](docs/integrations.md) | Claude Code, Cursor, VS Code, Windsurf, Antigravity, Desktop — paths & formats |
| [Configuration](docs/configuration.md) | Environment variables, `.hnindexignore` |
| [Tools reference](docs/tools-reference.md) | `index_codebase`, `search` modes, tips |
| [How it works](docs/how-it-works.md) | Pipeline, hybrid RRF, storage, languages |
| [Changelog](docs/changelog.md) | v0.3.x highlights |
| [Development](docs/development.md) | Clone, build, repo layout, roadmap |
| [Troubleshooting & FAQ](docs/troubleshooting.md) | Degraded mode, where data lives |

Full index: **[docs/README.md](docs/README.md)**

---

## Quick install

1. Install [Node.js 20+](https://nodejs.org/), [Ollama](https://ollama.com/) with `bge-m3:567m`, and [Qdrant](https://qdrant.tech/documentation/guides/installation/) (Docker or Cloud).
2. Add to your MCP config — **self-hosted** example:

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

For **Qdrant Cloud**, add `QDRANT_API_KEY` and set `QDRANT_URL` to your HTTPS cluster URL — see [Getting started](docs/getting-started.md).

3. Restart the IDE / assistant and use tools like `index_codebase` and `search`.

---

## Features

| Capability | Details |
|------------|---------|
| **Keyword** | SQLite FTS5 + BM25 |
| **Semantic** | Qdrant + bge-m3 (1024-dim) |
| **Hybrid** | Reciprocal Rank Fusion (RRF) |
| **Chunking** | Boundary-aware lines, overlap |
| **Incremental** | SHA-256 — skip unchanged files |
| **Languages** | 40+ (TS, Py, Go, Rust, …) |
| **Resilience** | Keyword search if Qdrant/Ollama unavailable |

---

## Architecture

<p align="center">
  <img src="assets/architecture.svg" alt="vibe-hnindex architecture" width="820"/>
</p>

<p align="center">
  <a href="docs/how-it-works.md">How indexing & search work →</a>
</p>

---

## License

MIT — see [LICENSE](LICENSE).

## Contributing

Issues and PRs: [github.com/AndyAnh174/vibe-hnindex](https://github.com/AndyAnh174/vibe-hnindex).

## Contact

**Ho Viet Anh (AndyAnh174)** · [hovietanh147@gmail.com](mailto:hovietanh147@gmail.com) · [GitHub](https://github.com/AndyAnh174)
