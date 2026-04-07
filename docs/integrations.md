# Integrations

After you have the MCP JSON from [Getting started](getting-started.md), **this page only answers: which file to edit** for each product. The `mcpServers` / `servers` payload is the same idea everywhere:

---

## hnindex CLI

Instead of pasting JSON by hand, install **[hnindex-cli](https://www.npmjs.com/package/hnindex-cli)** (`npm install -g hnindex-cli`) and run e.g.:

```bash
hnindex init --mcp antigravity
hnindex init --mcp claude --cwd /path/to/repo
hnindex init --mcp vscode --cwd /path/to/repo
```

See [Getting started → CLI installer](getting-started.md#cli-installer-hnindex) for all `--mcp` values and flags. The CLI merges the same `npx -y vibe-hnindex` block as the examples below.

---

- **Self-hosted Qdrant:** `OLLAMA_*`, `QDRANT_URL` (no API key).
- **Qdrant Cloud:** also set `QDRANT_API_KEY` and an HTTPS `QDRANT_URL`.
- **Optional HTTP rerank:** `RERANK_URL` (and `SEARCH_RERANK`, `SEARCH_RERANK_POOL`, `RERANK_TIMEOUT_MS`) — see [Configuration → Optional rerank](configuration.md#optional-rerank). Ollama-only setups do not require `RERANK_URL`.

---

## Claude Code (plugin marketplace)

No manual JSON required:

```
/plugin marketplace add AndyAnh174/vibe-hnindex
/plugin install vibe-hnindex@vibe-hnindex-marketplace
```

---

## Claude Code CLI (manual)

Create `.mcp.json` in the project root:

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

---

## Claude Desktop

Edit `claude_desktop_config.json`:

| OS | Path |
|----|------|
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Same `mcpServers` JSON as above.

---

## Google Antigravity

Google **Antigravity** (Gemini-based IDE) stores MCP config in one file. The JSON shape matches other clients: a root object with **`mcpServers`**.

### Config file location

| OS | Path |
|----|------|
| Windows | `C:\Users\<USER>\.gemini\antigravity\mcp_config.json` |
| macOS / Linux | `~/.gemini/antigravity/mcp_config.json` |

Create the folders `.gemini/antigravity/` if they do not exist.

### Edit from the UI

**⋮** (menu) → **MCP** → **Manage MCP Servers** → **View raw config** — this opens the same `mcp_config.json`.

### Example (npm / `npx`, same as Getting started)

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

You can rename `"vibe-hnindex"` to any label (e.g. `"codebase-knowledge"`). It only affects the name shown in the MCP list.

### Local dev (run your own `dist/index.js`)

If you built the repo locally:

```json
{
  "mcpServers": {
    "vibe-hnindex": {
      "command": "node",
      "args": ["D:/path/to/vibe-hnindex/dist/index.js"],
      "env": {
        "OLLAMA_URL": "http://localhost:11434",
        "OLLAMA_MODEL": "bge-m3:567m",
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}
```

Use forward slashes or escaped backslashes in `args` on Windows. Point `OLLAMA_URL` / `QDRANT_URL` to wherever **your** services run (remote Ollama is fine).

---

## Cursor

- Project: `.cursor/mcp.json`
- Global (examples):
  - Windows: `%APPDATA%\Cursor\User\globalStorage\cursor.mcp\mcp.json`
  - macOS / Linux: `~/.cursor/mcp.json`

---

## Windsurf

`~/.windsurf/mcp_config.json` (same path on Windows, macOS, Linux)

---

## VS Code (Copilot)

`.vscode/mcp.json` in the project root uses the `servers` key:

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

For Qdrant Cloud, add `QDRANT_API_KEY` and your HTTPS `QDRANT_URL` to `env`.

---

[← Back to docs index](README.md)
