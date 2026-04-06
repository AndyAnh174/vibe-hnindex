# Getting started

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
