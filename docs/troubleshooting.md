# Troubleshooting & FAQ

## Error handling

| Situation | Behavior |
|-----------|----------|
| Ollama unavailable | Error message; **keyword** search still works |
| Qdrant unavailable | Error message; **keyword** search still works |
| Qdrant Cloud **401** / auth errors | Set `QDRANT_API_KEY` to the key from [Qdrant Cloud](https://cloud.qdrant.io/) and ensure `QDRANT_URL` is the exact HTTPS endpoint (with port if shown). |
| Hybrid with services down | Falls back to keyword + warning |
| Unreadable / huge / binary file | Skipped; reported in index summary |

---

## FAQ

**Where is data stored?**  
SQLite: `~/.vibe-hnindex/knowledge.db` (or `STORAGE_PATH`). Qdrant: your Docker volume or Cloud project.

**Does a new chat lose the index?**  
No. Data is on disk until you run `delete_project`.

**Is Docker required?**  
Only for self-hosted Qdrant. Keyword mode works without Qdrant/Ollama.

**Can Ollama run on another machine?**  
Yes — set `OLLAMA_URL` in MCP `env`.

**Is re-index slow?**  
Incremental: only files with changed SHA-256 hashes are reprocessed.

---

[← Back to docs index](README.md)
