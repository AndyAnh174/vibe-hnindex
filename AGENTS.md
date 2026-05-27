# AGENTS.md — vibe-hnindex

This project is an MCP (Model Context Protocol) server for indexing and searching codebases. Read CLAUDE.md for full tool reference and best practices.

## Project Rules

### Release Workflow — 7 steps
When creating a new version, ALL of these must be updated:
1. `docs/changelog.md`
2. `website/src/app/[locale]/changelog/changelog-data.ts`
3. `package.json` + `packages/hnindex-cli/package.json`
4. `server.json` (MCP marketplace metadata)
5. `src/index.ts` (McpServer version + console.error log)
6. `.claude-plugin/marketplace.json` (Claude Code plugin)
7. `git tag -a vX.Y.Z -m "..." && git push --tags` (GitHub Releases)

### Branch & Version Workflow
- Always create a new branch for each feature/fix (NEVER work directly on main)
- New major feature → `v0.(N+1).0` → branch: `feature/v0.X.0-description`
- Bug fix / minor addon → `v0.N.(X+1)` → branch: `fix/v0.N.X-description` or `feature/v0.N.X-description`
- Done → report to user → user checks → user OKs → merge to main

### Tech Stack
- TypeScript, Node.js MCP server
- SQLite FTS5 + Qdrant (vectors) + Ollama (embeddings)
- Hybrid RRF search (keyword + semantic)
- Website: Next.js 16, shadcn/ui v4, next-intl, magicui
- Deploy: Vercel (vibe-hnindex.vercel.app)
- npm: vibe-hnindex + hnindex-cli

### After Merge
- Build: `npm run build`
- Publish: `npm publish --access public` (root) + `cd packages/hnindex-cli && npm publish --access public`
- Tags: `git tag -a vX.Y.Z -m "..." && git push --tags`
- GitHub Releases: `gh release create vX.Y.Z --title "..." --notes "..."`
