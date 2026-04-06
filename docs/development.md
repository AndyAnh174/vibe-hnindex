# Development

```bash
git clone https://github.com/AndyAnh174/vibe-hnindex.git
cd vibe-hnindex
npm install
npm run build
npm run dev   # tsx src/index.ts
```

On **Windows**, if `npm install` fails on `better-sqlite3`, use **Node 20 or 22 LTS** or install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (C++ workload). See [Troubleshooting](troubleshooting.md#windows-npm-install).

## Layout

```
src/
├── index.ts           # MCP server + tool registration
├── config.ts
├── types.ts
├── services/
│   ├── sqlite.ts      # SQLite + FTS5
│   ├── qdrant.ts      # Qdrant client
│   ├── embeddings.ts  # Ollama embed
│   ├── chunker.ts
│   └── file-scanner.ts
└── tools/               # MCP tool handlers
```

## Roadmap (informal)

- [x] Watch mode (`watch_project` / `unwatch_project`)
- [ ] Richer filters (language / path — partially available)
- [ ] AST-aware chunking
- [ ] Web UI for projects
- [ ] More embedding backends

---

[← Back to docs index](README.md)
