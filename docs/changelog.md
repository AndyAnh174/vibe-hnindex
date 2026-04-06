# Changelog (highlights)

## v0.3.3

- **`QDRANT_API_KEY`** — optional for local Docker; **required** for [Qdrant Cloud](https://cloud.qdrant.io/) (set with `QDRANT_URL` = HTTPS cluster URL from the dashboard).
- **Startup hint** — if `QDRANT_URL` looks like Cloud (HTTPS + `qdrant` host) but the API key is missing, the server logs a clear warning on first Qdrant use.
- **Docs** — [Getting started](getting-started.md) and [Configuration](configuration.md) spell out Cloud vs self-hosted env vars; default `OLLAMA_URL` is `http://localhost:11434` (override with `OLLAMA_URL` when needed).

## v0.3.2

- **`content_mode`** (default `compact`) — truncates chunk bodies to save tokens; use `full` for entire chunks.
- **Keyword OR fallback** — if strict FTS AND returns nothing and the query has multiple tokens, retry with OR and a warning.
- **`deprioritize_generated_paths`** — down-ranks `dist/`, `.next/`, `build/`, `coverage/`, `*.min.js`, `node_modules`, etc.
- **`project_stats` retry** — reduces rare “project not found” right after indexing.

## v0.3.1

- **Keyword query normalization** — tokenizes punctuation-heavy queries for FTS5.
- **`dedupe_by_file`** — one chunk per file by default.
- **`.hnindexignore`** — exclude paths from indexing (minimatch).

---

[← Back to docs index](README.md)
