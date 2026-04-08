# Getting started

Follow this page in order. If `npm install` fails on **Windows**, see **§ Before `npm install` (Windows)** below, then [Troubleshooting → Windows](troubleshooting.md#windows-npm-install).

---

## Before `npm install` (Windows)

`vibe-hnindex` depends on **`better-sqlite3`** (native code). On Windows, npm may need to **compile** it if no prebuilt binary exists for your **Node version**.

**Do this first (recommended):**

- Use **Node.js 20.x or 22.x LTS** (from [nodejs.org](https://nodejs.org/) or [nvm-windows](https://github.com/coreybutler/nvm-windows)). Avoid very new versions (e.g. Node 24) if install fails without build tools.

**If `npm install` / `npm i vibe-hnindex` still fails with `node-gyp` / “Visual Studio” / “Desktop development with C++”:**

- Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with workload **“Desktop development with C++”**, then run `npm i` again.

Details: [Troubleshooting](troubleshooting.md#windows-npm-install).

---

## Prerequisites

### 1. Node.js ≥ 20

```bash
node -v
```

### 2. Ollama (embedding server)

```bash
# https://ollama.com/download
ollama pull bge-m3:567m
ollama serve
```

Remote Ollama: set `OLLAMA_URL=http://your-server:11434` in MCP `env`.

### 3. Qdrant (vector database)

**Self-hosted (Docker):**

```bash
docker run -d --name qdrant -p 6333:6333 -v qdrant_storage:/qdrant/storage qdrant/qdrant
```

**Or** use [Qdrant Cloud](https://cloud.qdrant.io/) — set `QDRANT_URL` to your HTTPS endpoint and add `QDRANT_API_KEY`. See [Configuration](configuration.md).

> **Note:** Keyword search works **without** Qdrant. Qdrant is only required for semantic / hybrid search.

---

## CLI installer (hnindex)

Install the helper globally (Windows, macOS, Linux — needs Node ≥ 20):

```bash
npm install -g hnindex-cli
```

Pick your editor and merge **vibe-hnindex** into the correct config file (creates folders if needed; does not remove other MCP servers):

| Command | Writes to |
|---------|-----------|
| `hnindex init --mcp claude` | `.mcp.json` in the current directory (Claude Code) |
| `hnindex init --mcp claude-desktop` | Claude Desktop user config (path varies by OS — see [Integrations](integrations.md#claude-desktop)) |
| `hnindex init --mcp antigravity` | `~/.gemini/antigravity/mcp_config.json` |
| `hnindex init --mcp cursor` | Cursor **global** MCP file (see [Integrations → Cursor](integrations.md#cursor)) |
| `hnindex init --mcp cursor-project` | `.cursor/mcp.json` under `--cwd` (project-scoped) |
| `hnindex init --mcp windsurf` | `~/.windsurf/mcp_config.json` |
| `hnindex init --mcp vscode` | `.vscode/mcp.json` under `--cwd` (uses `servers` key for Copilot) |

Useful flags: `--cwd <dir>` for project-based targets, `--ollama-url`, `--ollama-model`, `--embedding-dimensions` (must match Ollama vector length for that model), `--qdrant-url`, `--qdrant-api-key` (Qdrant Cloud), `--dry-run` (print JSON only), `--output <file>` (override path). Re-running `init` merges env into the existing server entry (keeps prior `EMBEDDING_DIMENSIONS` if you omit the flag). `hnindex update` runs `npm update -g hnindex-cli`.

List all targets: `hnindex init --list`.

---

## MCP configuration

### Self-hosted Qdrant (Docker / local)

No API key required:

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

### Qdrant Cloud

Add `QDRANT_API_KEY` and set `QDRANT_URL` to your cluster URL from the dashboard (include port if shown):

```json
{
  "mcpServers": {
    "vibe-hnindex": {
      "command": "npx",
      "args": ["-y", "vibe-hnindex"],
      "env": {
        "OLLAMA_URL": "http://localhost:11434",
        "OLLAMA_MODEL": "bge-m3:567m",
        "QDRANT_URL": "https://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.us-east-1-0.aws.cloud.qdrant.io:6333",
        "QDRANT_API_KEY": "your-qdrant-api-key"
      }
    }
  }
}
```

---

## Google Antigravity: where to put the MCP JSON

Antigravity reads MCP servers from **`mcp_config.json`** (not the same path as Cursor).

| | |
|--|--|
| **Windows** | `C:\Users\<you>\.gemini\antigravity\mcp_config.json` |
| **macOS / Linux** | `~/.gemini/antigravity/mcp_config.json` |
| **From the app** | **⋮** → **MCP** → **Manage MCP Servers** → **View raw config** |

Put the same top-level key **`mcpServers`** as in the examples above. Full notes and a copy-paste example: **[Integrations → Google Antigravity](integrations.md#google-antigravity)**.

---

## First steps in chat

1. Restart your AI tool after editing MCP config.
2. Try:

```
Index the codebase at D:/projects/my-app, name it my-app
```

```
Search my-app for authentication middleware
```

```
List all indexed projects
```

---

**Next:** [Integrations](integrations.md) for tool-specific config paths · [Tools reference](tools-reference.md) for `search` modes and parameters
