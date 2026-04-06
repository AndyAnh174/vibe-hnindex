# Configuration

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `bge-m3:567m` | Embedding model name |
| `STORAGE_PATH` | `~/.vibe-hnindex` | SQLite database directory |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant REST URL. For **Qdrant Cloud**, use the full HTTPS URL from the cluster page (often includes `:6333`). |
| `QDRANT_API_KEY` | *(unset)* | **Required** for Qdrant Cloud and any cluster that checks the `api-key` header. Omit for local Docker with no auth. |
| `QDRANT_COLLECTION_PREFIX` | `mcp_ck_` | Prefix for Qdrant collection names |
| `CHUNK_SIZE` | `60` | Target lines per chunk |
| `CHUNK_OVERLAP` | `5` | Overlap lines between chunks |
| `MAX_FILE_SIZE` | `1048576` | Max file size in bytes (1 MB) |

---

## `.hnindexignore`

Optional file at the **project root** (the path you pass to `index_codebase`). Gitignore-style patterns via `minimatch` (`*`, `**`, `/`). Excluded paths are not scanned; `index_file` and `watch` follow the same rules.

- **Re-index** after changing this file.
- Negation (`!`) is not supported in v1.

---

[← Back to docs index](README.md)
