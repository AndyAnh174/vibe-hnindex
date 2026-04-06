# How it works

## Architecture diagram

<p align="center">
  <img src="../assets/architecture.svg" alt="vibe-hnindex architecture" width="800"/>
</p>

---

## Indexing pipeline

```
Scan directory → filter (40+ extensions; skip node_modules, .git, dist…)
  → SHA-256 hash → skip unchanged files
  → chunk (≈60 lines, boundary-aware, overlap)
  → embed (Ollama bge-m3, batch 32, 1024-dim)
  → SQLite (text + FTS5) + Qdrant (vectors)
```

---

## Hybrid search (RRF)

Keyword and semantic runs are fused with Reciprocal Rank Fusion:

```
score(chunk) = 1/(60 + rank_keyword) + 1/(60 + rank_semantic)
```

Chunks that appear in both lists get higher combined scores.

---

## Data storage

| Component | Typical location | Role |
|-----------|------------------|------|
| SQLite | `~/.vibe-hnindex/knowledge.db` | Chunks, FTS5, project metadata |
| Qdrant | Docker volume or Cloud | Vectors (cosine, 1024-dim) |

Each project maps to one Qdrant collection: `{QDRANT_COLLECTION_PREFIX}{sanitized_project_name}` (default prefix `mcp_ck_`).

Data persists across IDE sessions and chats until you delete the project.

---

## Supported languages

TypeScript, JavaScript, Python, Java, Go, Rust, C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala, Lua, Bash, SQL, Vue, Svelte, HTML, CSS, SCSS, YAML, TOML, JSON, XML, Markdown, Protobuf, GraphQL, Terraform, Zig, Elixir, Erlang, Clojure, Haskell, OCaml, F#, Dart, Solidity, CMake, Gradle, Dockerfile, Makefile, and more.

**Skipped by default:** `node_modules`, `.git`, `dist`, `build`, `__pycache__`, `vendor`, lockfiles, binaries, files larger than `MAX_FILE_SIZE`.

---

[← Back to docs index](README.md)
