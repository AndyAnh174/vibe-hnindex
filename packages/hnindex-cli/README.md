# hnindex-cli

CLI to merge **[vibe-hnindex](https://www.npmjs.com/package/vibe-hnindex)** into your editor’s MCP JSON (Claude Code, Claude Desktop, Cursor, Antigravity, Windsurf, VS Code). Works on **Windows, macOS, and Linux** (Node.js **≥ 20**).

---

## Install

**Global (recommended)** — `hnindex` is on your `PATH`:

```bash
npm install -g hnindex-cli
```

**One-off without global install:**

```bash
npx hnindex-cli init --mcp antigravity
```

> npm’s package page sidebar shows `npm i hnindex-cli` by default; that installs **locally** in a project. For a global `hnindex` command, use `npm install -g hnindex-cli` as above.

Verify:

```bash
hnindex version
hnindex help
```

---

## What it does

- **`hnindex init --mcp <target>`** — merges a `vibe-hnindex` server entry into the right MCP config file (creates parent folders if needed). Existing other MCP servers are **not** removed.
- **`hnindex update`** — runs `npm update -g hnindex-cli`.
- **`hnindex version`** — prints the installed `hnindex-cli` version.

After a successful `init`, **restart the editor** or reload MCP servers so the new config is picked up.

---

## Prerequisites (for the MCP server itself)

`hnindex-cli` only writes JSON; **[vibe-hnindex](https://www.npmjs.com/package/vibe-hnindex)** needs **Ollama** (embeddings) and usually **Qdrant** for semantic search. See the repo [Getting started](https://github.com/AndyAnh174/vibe-hnindex/blob/main/docs/getting-started.md).

---

## `hnindex init --mcp <target>`

### Targets (where the file is written)

| `--mcp` | Config file |
|--------|-------------|
| `claude` | `.mcp.json` in the current directory (Claude Code) |
| `claude-desktop` | Claude Desktop user config (OS-specific path) |
| `antigravity` | `~/.gemini/antigravity/mcp_config.json` |
| `cursor` | Cursor **global** MCP file |
| `cursor-project` | `.cursor/mcp.json` under `--cwd` |
| `windsurf` | `~/.windsurf/mcp_config.json` |
| `vscode` | `.vscode/mcp.json` under `--cwd` |

List all targets and paths:

```bash
hnindex init --list
```

### Options

| Option | Description |
|--------|-------------|
| `--mcp <name>` | **Required.** One of the targets above. |
| `--name <label>` | JSON key for the server (default: `vibe-hnindex`). |
| `--ollama-url <url>` | Default: `http://localhost:11434` |
| `--ollama-model <name>` | Default: `bge-m3:567m` |
| `--qdrant-url <url>` | Default: `http://localhost:6333` |
| `--qdrant-api-key <key>` | Optional; use with Qdrant Cloud. |
| `--cwd <dir>` | Base directory for project-scoped files (default: current directory). |
| `--output <path>` | Write to this file instead of the default for `--mcp`. |
| `--dry-run` | Print merged JSON to **stdout**; do **not** write files. |

---

## Examples

**Antigravity (default paths):**

```bash
hnindex init --mcp antigravity
```

**Claude Code in a repo:**

```bash
cd ~/projects/my-app
hnindex init --mcp claude
```

**Cursor project-scoped MCP (`.cursor/mcp.json` in this repo):**

```bash
hnindex init --mcp cursor-project --cwd .
```

**VS Code Copilot MCP in this repo:**

```bash
hnindex init --mcp vscode --cwd .
```

**Custom Ollama host:**

```bash
hnindex init --mcp claude --ollama-url http://192.168.1.10:11434
```

**Qdrant Cloud:**

```bash
hnindex init --mcp vscode --cwd . \
  --qdrant-url "https://xxxx.us-east-1-0.aws.cloud.qdrant.io:6333" \
  --qdrant-api-key "your-api-key"
```

**Preview JSON without writing:**

```bash
hnindex init --mcp antigravity --dry-run
```

**Custom server key in JSON:**

```bash
hnindex init --mcp cursor --name my-hnindex
```

---

## Update CLI

```bash
hnindex update
```

Or manually:

```bash
npm update -g hnindex-cli
```

---

## Links

- **Monorepo:** [github.com/AndyAnh174/vibe-hnindex](https://github.com/AndyAnh174/vibe-hnindex) — package path `packages/hnindex-cli`
- **Full docs:** [Getting started → CLI](https://github.com/AndyAnh174/vibe-hnindex/blob/main/docs/getting-started.md#cli-installer-hnindex)
- **Integrations (paths per OS):** [integrations.md](https://github.com/AndyAnh174/vibe-hnindex/blob/main/docs/integrations.md)

## License

MIT
