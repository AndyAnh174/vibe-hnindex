<div align="center">

# vibe-hnindex

**Local MCP server — index your repo once, search it in every AI session**

*Keyword (SQLite FTS5) · Semantic (Qdrant + Ollama embeddings) · Hybrid — your code stays on disk*

[![npm](https://img.shields.io/npm/v/vibe-hnindex.svg?style=flat-square&logo=npm&label=npm)](https://www.npmjs.com/package/vibe-hnindex)
[![License](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-compatible-6366f1?style=flat-square)](https://modelcontextprotocol.io/)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)

**Latest release: v0.6.0**

</div>

---

## What this does

[vibe-hnindex](https://www.npmjs.com/package/vibe-hnindex) is a [Model Context Protocol](https://modelcontextprotocol.io/) server. After you **index** a folder once, assistants (Claude, Cursor, Windsurf, Antigravity, …) can **search** that codebase with paths and line ranges — data is stored locally (SQLite + optional Qdrant). Embeddings use **Ollama**; vectors use **Qdrant** (Docker, local, or [Qdrant Cloud](https://cloud.qdrant.io/) with `QDRANT_API_KEY`).

---

## How to read the docs (start here)

| Step | Doc | Purpose |
|------|-----|---------|
| **1** | **[Getting started](docs/getting-started.md)** | Install Node, Ollama, Qdrant; paste MCP JSON; first chat commands |
| **2** | **[Integrations](docs/integrations.md)** | Where to put the JSON — **including [Google Antigravity](docs/integrations.md#google-antigravity)** (`mcp_config.json`) — or use **[hnindex CLI](docs/getting-started.md#cli-installer-hnindex)** |
| **3** | **[Tools reference](docs/tools-reference.md)** | What each tool does (`index_codebase`, `search`, …) |

Everything else is optional: [Configuration](docs/configuration.md), [How it works](docs/how-it-works.md), [Troubleshooting](docs/troubleshooting.md).

**Full index:** [docs/README.md](docs/README.md)

---

## CLI installer (`hnindex`)

Optional — writes the MCP JSON for you (merge-safe, same `npx -y vibe-hnindex` block as in the docs):

```bash
npm install -g hnindex-cli
hnindex init --mcp antigravity    # or: claude, claude-desktop, cursor, cursor-project, windsurf, vscode
hnindex init --list               # show all targets and paths
hnindex update                    # npm update -g hnindex-cli
```

See **[Getting started → CLI](docs/getting-started.md#cli-installer-hnindex)** and [Integrations → hnindex CLI](docs/integrations.md#hnindex-cli).

---

## Install in 5 steps

1. **Node.js** — v20+ ([nodejs.org](https://nodejs.org/)). On **Windows**, **Node 20 or 22 LTS** is strongly recommended so `npm install` does not need a C++ compiler. See [Troubleshooting → Windows](docs/troubleshooting.md#windows-npm-install) if `npm i vibe-hnindex` fails.
2. **Ollama** — install from [ollama.com](https://ollama.com/), then: `ollama pull bge-m3:567m` and keep `ollama serve` running (or set `OLLAMA_URL` to a remote server).
3. **Qdrant** — for semantic/hybrid search: `docker run -d --name qdrant -p 6333:6333 qdrant/qdrant` (or use Qdrant Cloud). Keyword-only search works without Qdrant.
4. **MCP config** — add the server to your assistant’s MCP settings. Minimal example (self-hosted Qdrant):

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

5. **Restart** the IDE or assistant, then in chat ask to **index** a path and **search** — see [First steps](docs/getting-started.md#first-steps-in-chat).

For **Qdrant Cloud**, add `QDRANT_API_KEY` and set `QDRANT_URL` to your HTTPS cluster URL — details in [Getting started](docs/getting-started.md).

### Optional rerank (`RERANK_URL`)

Semantic/hybrid search already uses **Ollama** (`OLLAMA_URL`, `OLLAMA_MODEL` e.g. `bge-m3:567m`) for query vectors and **Qdrant** for retrieval. After that, the server can **reorder** the top pool of hits:

- **Without `RERANK_URL`:** reorder by **Qdrant semantic scores** (no extra network service). This is enough for most setups, including when you only run Ollama + Qdrant.
- **With `RERANK_URL`:** POST JSON `{ "query", "documents" }` to your URL; response `{ "scores": number[] }` (same length as `documents`). Use a **small HTTP service** you host that wraps your reranker; Ollama does not expose this contract on `:11434` by default.

**Ollama vs rerank:** pulling a reranker model in Ollama (e.g. `qllama/bge-reranker-v2-m3`) does **not** replace `RERANK_URL`—you still need an adapter service unless you only rely on the built-in Qdrant reorder. See [Configuration → Rerank](docs/configuration.md#optional-rerank).

| Env | Role |
|-----|------|
| `SEARCH_RERANK` | `false` disables post-retrieval reorder entirely (default: enabled). |
| `SEARCH_RERANK_POOL` | Max candidates considered before trim (default `50`). |
| `RERANK_URL` | Full URL of your `{query, documents}` → `{scores}` API (optional). |
| `RERANK_TIMEOUT_MS` | Timeout for that POST (default `15000`). |

### Google Antigravity

Use the **same** `mcpServers` block as above, but save it in Antigravity’s MCP file:

| | |
|--|--|
| **File** | `mcp_config.json` under **`.gemini/antigravity/`** in your user folder |
| **Windows** | `C:\Users\<your-username>\.gemini\antigravity\mcp_config.json` |
| **macOS / Linux** | `~/.gemini/antigravity/mcp_config.json` |
| **UI** | **⋮** menu → **MCP** → **Manage MCP Servers** → **View raw config** |

Step-by-step: [Integrations → Google Antigravity](docs/integrations.md#google-antigravity).

---

## Features (short)

| | |
|--|--|
| **Search** | Keyword (FTS5), semantic (vectors), hybrid (RRF fusion); optional post-retrieval reorder (Qdrant scores, or `RERANK_URL`) |
| **Storage** | SQLite on disk; Qdrant for vectors |
| **Indexing** | Incremental (hash per file), many languages, `.hnindexignore` |
| **Resilience** | If Qdrant/Ollama unavailable, keyword search can still work |

---

## Architecture

<p align="center">
  <img src="assets/architecture.svg" alt="vibe-hnindex architecture" width="820"/>
</p>

<p align="center">
  <a href="docs/how-it-works.md">How indexing &amp; search work →</a>
</p>

---

## License

MIT — see [LICENSE](LICENSE).

## Contributing

Issues and PRs: [github.com/AndyAnh174/vibe-hnindex](https://github.com/AndyAnh174/vibe-hnindex).

## Contact

**Ho Viet Anh (AndyAnh174)** · [hovietanh147@gmail.com](mailto:hovietanh147@gmail.com) · [GitHub](https://github.com/AndyAnh174)
