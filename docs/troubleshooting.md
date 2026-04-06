# Troubleshooting & FAQ

## Windows npm install

**Symptoms**

- `npm i vibe-hnindex` or `npm install` in a project that depends on `vibe-hnindex` fails.
- Log mentions `better-sqlite3`, `prebuild-install`, `node-gyp`, `No prebuilt binaries found`, or **Visual Studio** / **Desktop development with C++**.

**Why**

- `better-sqlite3` includes **native** code. npm either downloads a **prebuilt** binary or **compiles** with `node-gyp`.
- On some **Node + Windows** combinations there is **no prebuild**, so npm tries to compile.
- Compiling on Windows requires **Visual Studio Build Tools** (C++ workload). If that is missing, the install fails.

**What to do (pick one)**

1. **Use Node 20 or 22 LTS** (recommended first step). Install from [nodejs.org](https://nodejs.org/) or switch with [nvm-windows](https://github.com/coreybutler/nvm-windows). Then run `npm i` again. Many LTS versions get a prebuilt `better-sqlite3` and **no compiler** is needed.
2. **Install build tools** — [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) → workload **“Desktop development with C++”**, then run `npm i` again.
3. **Avoid bleeding-edge Node** (e.g. very new major versions) on Windows if installs keep failing without VS — prebuilds often lag.

**Not the root cause**

- Deprecation warnings (`fs.R_OK`, `url.parse`, `prebuild-install` deprecated) are noisy but usually **not** why install stops. The real failure is **`node-gyp` / missing VS** or **no prebuild**.

---

## Error handling (runtime)

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
