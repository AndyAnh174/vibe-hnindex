# Integrations

Use the same `env` block as [Getting started](getting-started.md): self-hosted Qdrant only needs `QDRANT_URL`; Qdrant Cloud also needs `QDRANT_API_KEY` and an HTTPS `QDRANT_URL`.

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

Edit `mcp_config.json`:

| OS | Path |
|----|------|
| Windows | `C:\Users\<USER>\.gemini\antigravity\mcp_config.json` |
| macOS / Linux | `~/.gemini/antigravity/mcp_config.json` |

Or: **⋮ menu → MCP → Manage MCP Servers → View raw config**

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
