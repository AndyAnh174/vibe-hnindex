# Development

```bash
git clone https://github.com/AndyAnh174/vibe-hnindex.git
cd vibe-hnindex
npm install
npm run build
npm run dev   # tsx src/index.ts
```

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
